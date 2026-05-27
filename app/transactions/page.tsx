'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate } from '@/lib/utils'

interface Tx { id:string;title:string;amount:number;type:string;transaction_date:string;payment_method:string;source:string;categories?:{name:string}|null }

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Tx[]>([])
  const [totals, setTotals] = useState({ income:0, expense:0 })

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('transactions').select('*, categories(name)').eq('user_id', user.id).order('transaction_date', { ascending:false }).limit(50)
    setTxs(data || [])
    const inc = (data||[]).filter((t:Tx)=>t.type==='income').reduce((a:number,t:Tx)=>a+t.amount,0)
    const exp = (data||[]).filter((t:Tx)=>t.type==='expense').reduce((a:number,t:Tx)=>a+t.amount,0)
    setTotals({ income:inc, expense:exp })
  }, [])

  useEffect(() => { load() }, [load])

  const payLabel: Record<string,string> = { pix:'PIX', debit:'Débito', credit:'Crédito', cash:'Dinheiro', transfer:'TED/DOC', boleto:'Boleto', auto_debit:'Déb. Automático' }

  return (
    <div>
      <div style={{ background:'#fff', borderBottom:'1px solid #E5E9F2', padding:'0 28px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ fontSize:16, fontWeight:700 }}>Lançamentos</div>
        <a href="/dashboard" style={{ padding:'7px 16px', background:'#2563EB', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', textDecoration:'none' }}>+ Adicionar</a>
      </div>
      <div style={{ padding:'24px 28px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
          {[{ label:'Receitas', value:formatBRL(totals.income), color:'#16A34A' },{ label:'Despesas', value:formatBRL(totals.expense), color:'#DC2626' },{ label:'Saldo Líquido', value:formatBRL(totals.income-totals.expense), color:'#2563EB' }].map((s,i)=>(
            <div key={i} className="card" style={{ padding:'18px 22px' }}>
              <div style={{ fontSize:11, color:'#9AA3B2', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>{s.label}</div>
              <div className="mono" style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ borderBottom:'1px solid #E5E9F2' }}>{['Data','Descrição','Categoria','Pagamento','Tipo','Valor'].map(h=><th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#9AA3B2', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</th>)}</tr></thead>
            <tbody>
              {txs.map(t=>(
                <tr key={t.id} style={{ borderBottom:'1px solid #E5E9F2' }}>
                  <td style={{ padding:'12px 16px', fontSize:12, color:'#5A6478' }}>{formatDate(t.transaction_date)}</td>
                  <td style={{ padding:'12px 16px' }}><span style={{ fontWeight:600, fontSize:13 }}>{t.title}</span>{t.source==='whatsapp'&&<span style={{ fontSize:10, background:'#DCFCE7', color:'#15803D', padding:'1px 5px', borderRadius:10, fontWeight:700, marginLeft:5 }}>WA</span>}</td>
                  <td style={{ padding:'12px 16px' }}><span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'#EFF4FF', color:'#2563EB' }}>{(t.categories as {name:string}|null)?.name||'—'}</span></td>
                  <td style={{ padding:'12px 16px', fontSize:12, color:'#5A6478' }}>{payLabel[t.payment_method]||t.payment_method}</td>
                  <td style={{ padding:'12px 16px' }}><span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:t.type==='income'?'#DCFCE7':'#FEF2F2', color:t.type==='income'?'#16A34A':'#DC2626' }}>{t.type==='income'?'Receita':'Despesa'}</span></td>
                  <td style={{ padding:'12px 16px' }}><span className={t.type==='income'?'amt-pos':'amt-neg'}>{t.type==='income'?'+':'-'}{formatBRL(t.amount)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
