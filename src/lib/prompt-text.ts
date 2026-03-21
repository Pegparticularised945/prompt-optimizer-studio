export function normalizeEscapedMultilineText(value: string) {
  if (value.includes('\n') || value.includes('\r')) {
    return value
  }

  const escapedBreakCount = value.match(/\\r\\n|\\n|\\r/g)?.length ?? 0
  if (escapedBreakCount < 2) {
    return value
  }

  const decoded = tryDecodeJsonEscapes(value)
  if (!decoded) {
    return value
  }

  return decoded.includes('\n') || decoded.includes('\r') ? decoded : value
}

function tryDecodeJsonEscapes(value: string) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string
  } catch {
    return null
  }
}
