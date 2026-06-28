export function formatBRL(v: number) {
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
}
export function formatDate(d: string|null|undefined) {
  if (!d) return '—'
  return new Date(d+'T12:00:00').toLocaleDateString('pt-BR')
}
export function monthStart(offset=0) {
  const d = new Date()
  d.setDate(1); d.setHours(0,0,0,0)
  d.setMonth(d.getMonth()+offset)
  return d.toISOString().split('T')[0]
}
export function monthEnd(start: string) {
  const d = new Date(start+'T12:00:00')
  return new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().split('T')[0]
}
export function monthLabel(start: string) {
  return new Date(start+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
}
