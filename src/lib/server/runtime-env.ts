import path from 'node:path'

export type RuntimeEdition = 'self-hosted-server'
export type RuntimeStorageMode = 'local-sqlite-file'

export type RuntimeEnv = {
  edition: RuntimeEdition
  databasePath: string
  storageMode: RuntimeStorageMode
}

export function resolveRuntimeEnv(cwd = process.cwd()): RuntimeEnv {
  return {
    edition: 'self-hosted-server',
    databasePath: process.env.PROMPT_OPTIMIZER_DB_PATH ?? path.join(cwd, 'data', 'prompt-optimizer.db'),
    storageMode: 'local-sqlite-file',
  }
}
