import { NextResponse } from 'next/server'

import { fetchCpamcModels } from '@/lib/server/models'
import { getSettings } from '@/lib/server/settings'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const settings = getSettings()
    const models = await fetchCpamcModels(settings)
    return NextResponse.json({ models })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch models.' },
      { status: 400 },
    )
  }
}
