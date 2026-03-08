export function extractJsonObject(payload: string) {
  const trimmed = payload.trim()
  if (!trimmed) {
    throw new Error('Model returned an empty response.')
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error(`Model did not return valid JSON. Payload: ${trimmed.slice(0, 400)}`)
    }
    return JSON.parse(match[0])
  }
}
