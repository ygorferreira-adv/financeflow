'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

function getMonthOptions() {
  const opts = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
    opts.push({ value:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, label:d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) })
  }
  return opts
}

const COLORS = ['#1D4ED8','#7C3AED','#DC2626','#D97706','#16A34A','#0891B2','#9333EA','#C2410C','#0F766E','#6B7280']

export default function ReportsPage() {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [catData, setCatData] = useState<{name:string;total:number;count:number}[]>([])
  const [monthly, setMonthly] = useState<{month:string;despesas:number;receitas:number;saldo:number}[]>([])
  const [summary, setSummary] = useState({ total_expense:0, total_income:0 })
  const monthOpts = getMonthOptions()

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const mDate = new Date(selectedMonth)
    const mStart = `${mDate.getFullYear()}-${String(mDate.getMonth()+1).padStart(2,'0')}-01`
    const mEnd = new Date(mDate.getFullYear(), mDate.getMonth()+1, 0).toISOString().split('T')[0]

    // Gastos por categoria
    const { data:cats } = await supabase.from('category_monthly').select('*').eq('user_id',user.id).eq('month',mStart)
    setCatData((cats||[]).map(c=>({ name:c.category_name||'Outros', total:c.total, count:c.count })).sort((a,b)=>b.total-a.total))

    // Resumo
    const { data:s } = await supabase.rpc('get_dashboard_summary',{ p_user_id:user.id, p_month:mStart })
    setSummary({ total_expense:s?.total_expense||0, total_income:s?.total_income||0 })

    // Evolução 6 meses
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth()-i)
      const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
      const { data:ms } = await supabase.from('monthly_summary').select('*').eq('user_id',user.id).eq('month',m).single()
      months.push({ month:d.toLocaleDateString('pt-BR',{month:'short'}), despesas:ms?.total_expense||0, receitas:ms?.total_income||0, saldo:(ms?.total_income||0)-(ms?.total_expense||0) })
    }
    setMonthly(months)
  }, [selectedMonth])

  useEffect(()=>{ load() },[load])

  const totalCat = catData.reduce((a,c)=>a+c.total,0)

  return (
    <div>
      <div style={{ background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 16px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50,boxShadow:'var(--shadow)' }}>
        <div>
          <div style={{ fontSize:16,fontWeight:700,letterSpacing:'-0.3px' }}>Relatórios</div>
          <div style={{ fontSize:11,color:'var(--muted)',fontWeight:500 }}>Análise financeira</div>
        </div>
        <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={{ width:'auto',padding:'6px 10px',fontSize:12,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC' }}>
          {monthOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div style={{ padding:'16px' }}>
        {/* KPIs */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16 }}>
          {[
            { label:'Despesas', value:formatBRL(summary.total_expense), color:'var(--danger)' },
            { label:'Receitas', value:formatBRL(summary.total_income), color:'var(--success)' },
            { label:'Saldo', value:formatBRL(summary.total_income-summary.total_expense), color:summary.total_income-summary.total_expense>=0?'var(--success)':'var(--danger)' },
          ].map((k,i)=>(
            <div key={i} style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:'12px',textAlign:'center',borderTop:`3px solid ${k.color}` }}>
              <div style={{ fontSize:9,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:14,fontWeight:800,color:k.color,fontFamily:'JetBrains Mono,monospace',letterSpacing:'-0.5px' }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Gráfico barras 6 meses */}
        <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'16px',marginBottom:14,boxShadow:'var(--shadow)' }}>
          <div style={{ fontSize:13,fontWeight:700,marginBottom:4 }}>Evolução 6 Meses</div>
          <div style={{ fontSize:11,color:'var(--muted)',marginBottom:14 }}>Receitas e despesas mensais</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthly} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize:10,fill:'#9CA3AF',fontFamily:'Inter' }} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip formatter={(v:number)=>formatBRL(v)} contentStyle={{ fontSize:11,borderRadius:8,border:'1px solid var(--border)' }}/>
              <Bar dataKey="receitas" name="Receitas" fill="#16A34A" radius={[4,4,0,0]}/>
              <Bar dataKey="despesas" name="Despesas" fill="#DC2626" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pizza + tabela categorias */}
        {catData.length > 0 && (
          <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'16px',boxShadow:'var(--shadow)' }}>
            <div style={{ fontSize:13,fontWeight:700,marginBottom:4 }}>Despesas por Categoria</div>
            <div style={{ fontSize:11,color:'var(--muted)',marginBottom:14 }}>{monthOpts.find(o=>o.value===selectedMonth)?.label}</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={2}>
                  {catData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v:number)=>formatBRL(v)} contentStyle={{ fontSize:11,borderRadius:8 }}/>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11 }}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ marginTop:12 }}>
              {catData.map((c,i)=>(
                <div key={i} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:i<catData.length-1?'1px solid #F8FAFC':'none' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <div style={{ width:10,height:10,borderRadius:3,background:COLORS[i%COLORS.length],flexShrink:0 }}/>
                    <span style={{ fontSize:12,fontWeight:600 }}>{c.name}</span>
                    <span style={{ fontSize:10,color:'var(--muted)',fontWeight:500 }}>{c.count}x</span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:13,fontWeight:700,fontFamily:'JetBrains Mono,monospace',color:'var(--text)',letterSpacing:'-0.3px' }}>{formatBRL(c.total)}</div>
                    <div style={{ fontSize:10,color:'var(--muted)',fontWeight:500 }}>{totalCat>0?((c.total/totalCat)*100).toFixed(1):'0'}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {catData.length === 0 && (
          <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'40px',textAlign:'center',color:'var(--muted)' }}>
            <div style={{ fontSize:32,marginBottom:10 }}>📊</div>
            <div style={{ fontSize:13,fontWeight:600 }}>Sem dados neste período</div>
          </div>
        )}
      </div>
    </div>
  )
}
