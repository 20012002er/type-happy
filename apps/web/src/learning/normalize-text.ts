export function normalizeEnglishSentence(
  value: string,
  caseSensitive: boolean,
  ignoreTerminalPunctuation: boolean,
): string {
  let normalized = value.trim().replace(/[‘’]/g, "'").replace(/\s+/g, ' ')
  if (ignoreTerminalPunctuation) normalized = normalized.replace(/[.!?。！？]+$/u, '')
  return caseSensitive ? normalized : normalized.toLocaleLowerCase()
}

export function normalizeEnglishSpelling(value: string, caseSensitive: boolean): string {
  const trimmed = value.trim()
  return caseSensitive ? trimmed : trimmed.toLocaleLowerCase()
}
