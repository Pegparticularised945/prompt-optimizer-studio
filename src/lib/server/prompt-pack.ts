import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { getDb } from '@/lib/server/db'
import { resolvePromptPackDir } from '@/lib/server/constants'
import type { PromptPackVersion } from '@/lib/server/types'

export function ensurePromptPackVersion(): PromptPackVersion {
  const pack = readPromptPackArtifacts()
  const hash = hashPromptPackArtifacts(pack)

  const db = getDb()
  const existing = db.prepare(`
    SELECT id, hash, skill_md, rubric_md, template_md, created_at
    FROM prompt_pack_versions
    WHERE hash = ?
  `).get(hash) as Record<string, unknown> | undefined

  if (existing) {
    return mapPromptPackRow(existing)
  }

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  db.prepare(`
    INSERT INTO prompt_pack_versions (id, hash, skill_md, rubric_md, template_md, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, hash, pack.skillMd, pack.rubricMd, pack.templateMd, createdAt)

  return {
    id,
    hash,
    createdAt,
    ...pack,
  }
}

export function getPromptPackVersion(id: string) {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, hash, skill_md, rubric_md, template_md, created_at
    FROM prompt_pack_versions
    WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined

  if (!row) {
    throw new Error(`Prompt pack version not found: ${id}`)
  }

  return mapPromptPackRow(row)
}

export function readPromptPackArtifacts(packDir = resolvePromptPackDir()) {
  const skillMd = fs.readFileSync(path.join(packDir, 'SKILL.md'), 'utf8')
  const rubricMd = fs.readFileSync(path.join(packDir, 'references', 'rubric.md'), 'utf8')
  const templateMd = fs.readFileSync(path.join(packDir, 'references', 'universal-template.md'), 'utf8')
  return { skillMd, rubricMd, templateMd }
}

export function hashPromptPackArtifacts(input: Pick<PromptPackVersion, 'skillMd' | 'rubricMd' | 'templateMd'>) {
  return createHash('sha256')
    .update(input.skillMd)
    .update(input.rubricMd)
    .update(input.templateMd)
    .digest('hex')
}

export function withPromptPackRubricOverride(pack: PromptPackVersion, rubricMd: string | null | undefined) {
  if (!rubricMd || rubricMd === pack.rubricMd) {
    return pack
  }

  return {
    ...pack,
    rubricMd,
    hash: hashPromptPackArtifacts({
      skillMd: pack.skillMd,
      rubricMd,
      templateMd: pack.templateMd,
    }),
  }
}

function mapPromptPackRow(row: Record<string, unknown>): PromptPackVersion {
  return {
    id: String(row.id),
    hash: String(row.hash),
    skillMd: String(row.skill_md),
    rubricMd: String(row.rubric_md),
    templateMd: String(row.template_md),
    createdAt: String(row.created_at),
  }
}
