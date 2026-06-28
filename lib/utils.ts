export function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
export function formatDate(date: string | Date) {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date
  return d.toLocaleDateString('pt-BR')
}