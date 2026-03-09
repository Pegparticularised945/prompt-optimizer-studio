import { NextResponse } from 'next/server'

import { resolveRuntimeEnv } from '@/lib/server/runtime-env'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: resolveRuntimeEnv(),
    timestamp: new Date().toISOString(),
  })
}
