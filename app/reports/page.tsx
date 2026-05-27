'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export default function ReportsPage() {
  const [summary, setSummary] = useState<{total_expense:number;total_income:number}>({ total_expense:0, total_income:0 })
  const [catData, setCatData] = useState<{name:string;total:number;color:string}[]>([])
  const [monthly, setMonthly] = useState<{month:string;despesas:number;receitas:number}[]>([])

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: s } = await supabase.rpc('get_dashboard_summary', { p_user_id: user.id })
    setSummary(s || { total_expense:0, total_income:0 })
    const { data: cm } = await supabase.from('category_monthly').select('*').eq('user_id', user.id).order('total', { ascending:false })
    setCatData((cm||[]).map((r:{category_name:string;total:number;color:string}) => ({ name:r.category_name||'Outros', total:r.total, color:r.color||'#2563EB' })))
    const months = []
    for (let i=4; i>=0; i--) {
      const d = new Date(); d.setMonth(d.getMonth()-i)
      const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
      const { data: ms } = await supabase.from('monthly_summary').select('total_expense,total_income').eq('user_id', user.id).eq('month', m).single()
      months.push({ month: d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}), despesas:ms?.total_expense||0, receitas:ms?.total_income||0 })
    }
    setMonthly(months)
  }, [])

  useEffect(() => { load() }, [load])

  const top = catData[0]
  const saving = summary.total_income - summary.total_expense
  const pct = summary.total_income > 0 ? ((saving/summary.total_income)*100).toFixed(0) : '0'

  return (
    <div>
      <div style={{ background:'#fff', borderBottom:'1px solid #E5E9F2', padding:'0 28px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ fontSize:16, fontWeight:700 }}>Relatórios</div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={{ padding:'7px 14px', border:'1px solid #CDD3E0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#5A6478', fontFamily:'DM Sans,sans-serif' }}>Exportar PDF</button>
          <button style={{ padding:'7px 14px', border:'1px solid #CDD3E0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#5A6478', fontFamily:'DM Sans,sans-serif' }}>Exportar CSV</button>
        </div>
      </div>
      <div style={{ padding:'24px 28px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
          {[{ label:'Total Gasto', value:formatBRL(summary.total_expense), color:'#DC2626' },{ label:'Maior Categoria', value:top?.name||'—', color:'#2563EB', sub: top?formatBRL(top.total):undefined },{ label:'Economia', value:formatBRL(saving), color:saving>=0?'#16A34A':'#DC2626', sub:`${pct}% da receita` }].map((s,i)=>(
            <div key={i} className="card" style={{ padding:'20px 22px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:'#9AA3B2', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>{s.label}</div>
              <div className="mono" style={{ fontSize:26, fontWeight:700, color:s.color, letterSpacing:'-1px' }}>{s.value}</div>
              {s.sub && <div style={{ fontSize:12, color:'#9AA3B2', marginTop:4 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div className="card" style={{ padding:'20px 24px' }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Gastos por Categoria</div>
            {catData.map(c => (
              <div key={c.name} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{c.name}</span>
                  <span className="mono" style={{ fontSize:13, fontWeight:700 }}>{formatBRL(c.total)}</span>
                </div>
                <div style={{ height:7, background:'#F0F2F7', borderRadius:4 }}>
                  <div style={{ height:'100%', borderRadius:4, background:c.color||'#2563EB', width:`${Math.min((c.total/(summary.total_expense||1))*100,100)}%`, transition:'width 0.4s' }}/>
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding:'20px 24px' }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Evolução 5 Meses</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthly}>
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'#9AA3B2' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:'#9AA3B2' }} axisLine={false} tickLine={false} width={70} tickFormatter={v=>formatBRL(v)} />
                <Tooltip formatter={(v:number)=>formatBRL(v)} />
                <Line type="monotone" dataKey="despesas" stroke="#DC2626" strokeWidth={2} dot={{ fill:'#DC2626', r:4 }} name="Despesas" />
                <Line type="monotone" dataKey="receitas" stroke="#16A34A" strokeWidth={2} dot={{ fill:'#16A34A', r:4 }} name="Receitas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
