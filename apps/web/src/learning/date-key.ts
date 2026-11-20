function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toLocalDateKey(value: Date | number): string {
  const date = typeof value === 'number' ? new Date(value) : value
  if (!Number.isFinite(date.getTime()))
    throw new Error('Cannot create a date key from an invalid date')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseLocalDateKey(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error(`无效的本地日期键：${value}`)
  const [, year, month, day] = match
  const date = new Date(0)
  date.setFullYear(Number(year), Number(month) - 1, Number(day))
  date.setHours(12, 0, 0, 0)
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    throw new Error(`无效的本地日期键：${value}`)
  }
  return date
}

export function assertLocalDateKey(value: string): string {
  parseLocalDateKey(value)
  return value
}

export function shiftLocalDateKey(value: string, days: number): string {
  if (!Number.isSafeInteger(days)) throw new Error('日期偏移天数必须是安全整数')
  const date = parseLocalDateKey(value)
  date.setDate(date.getDate() + days)
  return toLocalDateKey(date)
}
