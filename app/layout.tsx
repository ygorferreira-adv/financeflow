import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = {
  title:'FinanceFlow',
  description:'Controle financeiro pessoal',
}
export default function RootLayout({children}:{children:React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/></head>
      <body>{children}</body>
    </html>
  )
}
