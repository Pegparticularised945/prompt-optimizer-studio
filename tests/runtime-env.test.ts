import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { GET } from '../src/app/api/health/route'
import { resolveRuntimeEnv } from '../src/lib/server/runtime-env'

test('resolveRuntimeEnv exposes default self-hosted paths', () => {
  const originalDbPath = process.env.PROMPT_OPTIMIZER_DB_PATH
  delete process.env.PROMPT_OPTIMIZER_DB_PATH

  try {
    const runtime = resolveRuntimeEnv('/app')
    assert.equal(runtime.edition, 'self-hosted-server')
    assert.equal(runtime.databasePath, path.join('/app', 'data', 'prompt-optimizer.db'))
    assert.equal(runtime.storageMode, 'local-sqlite-file')
  } finally {
    if (originalDbPath === undefined) {
      delete process.env.PROMPT_OPTIMIZER_DB_PATH
    } else {
      process.env.PROMPT_OPTIMIZER_DB_PATH = originalDbPath
    }
  }
})

test('resolveRuntimeEnv honors PROMPT_OPTIMIZER_DB_PATH override', () => {
  const originalDbPath = process.env.PROMPT_OPTIMIZER_DB_PATH
  process.env.PROMPT_OPTIMIZER_DB_PATH = '/srv/prompt-optimizer/custom.db'

  try {
    const runtime = resolveRuntimeEnv('/app')
    assert.equal(runtime.databasePath, '/srv/prompt-optimizer/custom.db')
  } finally {
    if (originalDbPath === undefined) {
      delete process.env.PROMPT_OPTIMIZER_DB_PATH
    } else {
      process.env.PROMPT_OPTIMIZER_DB_PATH = originalDbPath
    }
  }
})

test('health route returns runtime deployment summary without secrets', async () => {
  const originalDbPath = process.env.PROMPT_OPTIMIZER_DB_PATH
  process.env.PROMPT_OPTIMIZER_DB_PATH = '/srv/prompt-optimizer/health.db'

  try {
    const response = await GET()
    assert.equal(response.status, 200)

    const payload = (await response.json()) as {
      ok: boolean
      runtime: {
        edition: string
        databasePath: string
        storageMode: string
      }
      timestamp: string
    }

    assert.equal(payload.ok, true)
    assert.equal(payload.runtime.edition, 'self-hosted-server')
    assert.equal(payload.runtime.databasePath, '/srv/prompt-optimizer/health.db')
    assert.equal(payload.runtime.storageMode, 'local-sqlite-file')
    assert.equal(typeof payload.timestamp, 'string')
    assert.equal('cpamcApiKey' in payload, false)
  } finally {
    if (originalDbPath === undefined) {
      delete process.env.PROMPT_OPTIMIZER_DB_PATH
    } else {
      process.env.PROMPT_OPTIMIZER_DB_PATH = originalDbPath
    }
  }
})
