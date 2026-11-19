function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toLocalDateKey(value: Date | number): string {
  const date = typeof value === 'number' ? new Date(value) : value
  if (!Number.isFinite(date.getTime()))
    throw new Error('Cannot create a date key from an invalid date')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
