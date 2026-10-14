export function fmt(n: number): string {
  const v = Math.floor(n)
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(1)}万`
  return String(v)
}

export function fmtDur(ms: number): string {
  if (ms <= 0) return '就绪'
  const sec = Math.ceil(ms / 1000)
  if (sec < 60) return `${sec}秒`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分${sec % 60}秒`
  const h = Math.floor(min / 60)
  return `${h}小时${min % 60}分`
}

export function fmtRate(n: number): string {
  if (n >= 10000) return `${fmt(n)}/时`
  return `${Math.round(n)}/时`
}
