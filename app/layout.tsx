import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = {
  title: 'FinanceFlow',
  description: 'Controle financeiro',
  other: { 'viewport': 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' }
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" style={{ width:'100%', overflowX:'hidden' }}>
      <body style={{ width:'100%', overflowX:'hidden', margin:0, padding:0 }}>
        {children}
      </body>
    </html>
  )
}