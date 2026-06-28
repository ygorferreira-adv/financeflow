'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate } from '@/lib/utils'
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

function getFutureMonths() {
  const opts = []
  const now = new Date()
  for (let i = 0; i <= 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth()+i, 1)
    opts.push({ value:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, label:d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) })
  }
  return opts
}

const COLORS = ['#1D4ED8','#7C3AED','#DC2626','#D97706','#16A34A','#0891B2','#9333EA','#C2410C','#0F766E','#6B7280']

interface Bill { id:string;title:string;amount:number;due_date:string;status:string;category_name:string;recurrence:string }

export default function ReportsPage() {
  const now = new Date()
  const curMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const [tab, setTab] = useState<'month'|'future'>('month')
  const [selectedMonth, setSelectedMonth] = useState(curMonth)
  const [futureMonth, setFutureMonth] = useState(curMonth)
  const [catData, setCatData] = useState<{name:string;total:number;count:number}[]>([])
  const [monthly, setMonthly] = useState<{month:string;label:string;despesas:number;receitas:number}[]>([])
  const [summary, setSummary] = useState({total_expense:0,total_income:0})
  const [futureBills, setFutureBills] = useState<Bill[]>([])
  const [futureTotal, setFutureTotal] = useState(0)
  const monthOpts = getMonthOptions()
  const futureMonthOpts = getFutureMonths()

  const loadMonth = useCallback(async () => {
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) return
    const mDate = new Date(selectedMonth)
    const mStart = `${mDate.getFullYear()}-${String(mDate.getMonth()+1).padStart(2,'0')}-01`

    // Buscar transações diretamente (mais confiável que a view)
    const mEnd = new Date(mDate.getFullYear(), mDate.getMonth()+1, 0).toISOString().split('T')[0]
    const {data:txs} = await supabase.from('transactions')
      .select('amount,type,categories(name)')
      .eq('user_id',user.id)
      .eq('status','confirmed')
      .gte('transaction_date',mStart)
      .lte('transaction_date',mEnd)

    const totalExp = (txs||[]).filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0)
    const totalInc = (txs||[]).filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0)
    setSummary({total_expense:totalExp,total_income:totalInc})

    // Categorias
    const catMap: Record<string,{total:number,count:number}> = {}
    ;(txs||[]).filter(t=>t.type==='expense').forEach(t=>{
      const name = (t.categories as {name:string}|null)?.name || 'Outros'
      if (!catMap[name]) catMap[name]={total:0,count:0}
      catMap[name].total += t.amount
      catMap[name].count += 1
    })
    setCatData(Object.entries(catMap).map(([name,v])=>({name,...v})).sort((a,b)=>b.total-a.total))

    // Gráfico 6 meses — buscar transações direto, não da view
    const months = []
    for (let i=5;i>=0;i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
      const mS = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
      const mE = new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().split('T')[0]
      const {data:mt} = await supabase.from('transactions')
        .select('amount,type')
        .eq('user_id',user.id)
        .eq('status','confirmed')
        .gte('transaction_date',mS)
        .lte('transaction_date',mE)
      const exp = (mt||[]).filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0)
      const inc = (mt||[]).filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0)
      months.push({month:mS,label:d.toLocaleDateString('pt-BR',{month:'short'}),despesas:exp,receitas:inc})
    }
    setMonthly(months)
  },[selectedMonth])

  const loadFuture = useCallback(async () => {
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) return
    const mDate = new Date(futureMonth)
    const mStart = `${mDate.getFullYear()}-${String(mDate.getMonth()+1).padStart(2,'0')}-01`
    const mEnd = new Date(mDate.getFullYear(),mDate.getMonth()+1,0).toISOString().split('T')[0]
    const {data} = await supabase.from('bills_live')
      .select('*')
      .eq('user_id',user.id)
      .gte('due_date',mStart)
      .lte('due_date',mEnd)
      .neq('status','cancelled')
      .order('due_date')
    setFutureBills(data||[])
    setFutureTotal((data||[]).filter(b=>b.status!=='paid').reduce((a,b)=>a+b.amount,0))
  },[futureMonth])

  useEffect(()=>{ if(tab==='month') loadMonth() },[tab,loadMonth])
  useEffect(()=>{ if(tab==='future') loadFuture() },[tab,loadFuture])

  const totalCat = catData.reduce((a,c)=>a+c.total,0)
  const saldo = summary.total_income - summary.total_expense

  return (
    <div style={{minHeight:'100vh',overflow:'hidden',width:'100%'}}>
      <div style={{background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50}}>
        <div>
          <div style={{fontSize:15,fontWeight:700}}>Relatórios</div>
          <div style={{fontSize:11,color:'var(--muted)',fontWeight:500}}>Análise financeira</div>
        </div>
      </div>

      <div style={{padding:'14px 16px'}}>
        {/* TABS */}
        <div style={{display:'flex',gap:4,background:'#F1F5F9',padding:4,borderRadius:10,marginBottom:14}}>
          <button onClick={()=>setTab('month')} style={{flex:1,padding:'8px',border:'none',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600,background:tab==='month'?'#fff':'transparent',color:tab==='month'?'var(--accent)':'var(--muted)',boxShadow:tab==='month'?'var(--shadow)':'none'}}>📊 Por Mês</button>
          <button onClick={()=>setTab('future')} style={{flex:1,padding:'8px',border:'none',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600,background:tab==='future'?'#fff':'transparent',color:tab==='future'?'var(--accent)':'var(--muted)',boxShadow:tab==='future'?'var(--shadow)':'none'}}>📋 Contas Futuras</button>
        </div>

        {/* ABA: ANÁLISE MENSAL */}
        {tab==='month'&&(
          <div>
            <div style={{marginBottom:14}}>
              <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={{width:'100%',padding:'8px 10px',fontSize:12,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC'}}>
                {monthOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
              {[
                {label:'Despesas',value:formatBRL(summary.total_expense),color:'var(--danger)'},
                {label:'Receitas',value:formatBRL(summary.total_income),color:'var(--success)'},
                {label:'Saldo',value:formatBRL(saldo),color:saldo>=0?'var(--success)':'var(--danger)'},
              ].map((k,i)=>(
                <div key={i} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:'10px 10px',borderTop:`3px solid ${k.color}`,textAlign:'center'}}>
                  <div style={{fontSize:9,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>{k.label}</div>
                  <div style={{fontSize:13,fontWeight:800,color:k.color,fontFamily:'JetBrains Mono,monospace',letterSpacing:'-0.5px'}}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Gráfico barras 6 meses */}
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'14px',marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Evolução 6 Meses</div>
              <div style={{fontSize:10,color:'var(--muted)',marginBottom:12}}>Receitas e despesas mensais</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthly} barGap={2}>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:'#9CA3AF',fontFamily:'Inter'}} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip formatter={(v:number)=>formatBRL(v)} contentStyle={{fontSize:11,borderRadius:8,border:'1px solid var(--border)'}}/>
                  <Bar dataKey="receitas" name="Receitas" fill="#16A34A" radius={[3,3,0,0]}/>
                  <Bar dataKey="despesas" name="Despesas" fill="#DC2626" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pizza categorias */}
            {catData.length>0?(
              <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'14px'}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Despesas por Categoria</div>
                <div style={{fontSize:10,color:'var(--muted)',marginBottom:12}}>{monthOpts.find(o=>o.value===selectedMonth)?.label}</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={catData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                      {catData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={(v:number)=>formatBRL(v)} contentStyle={{fontSize:11,borderRadius:8}}/>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:10}}/>
                  </PieChart>
                </ResponsiveContainer>
                {catData.map((c,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 0',borderBottom:i<catData.length-1?'1px solid #F8FAFC':'none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <div style={{width:9,height:9,borderRadius:2,background:COLORS[i%COLORS.length],flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:600}}>{c.name}</span>
                      <span style={{fontSize:10,color:'var(--muted)'}}>{c.count}x</span>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:12,fontWeight:700,fontFamily:'JetBrains Mono,monospace',color:'var(--text)'}}>{formatBRL(c.total)}</div>
                      <div style={{fontSize:9,color:'var(--muted)'}}>{totalCat>0?((c.total/totalCat)*100).toFixed(1):'0'}%</div>
                    </div>
                  </div>
                ))}
              </div>
            ):(
              <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'36px',textAlign:'center',color:'var(--muted)'}}>
                <div style={{fontSize:28,marginBottom:8}}>📊</div>
                <div style={{fontSize:13,fontWeight:600}}>Sem despesas neste período</div>
              </div>
            )}
          </div>
        )}

        {/* ABA: CONTAS FUTURAS */}
        {tab==='future'&&(
          <div>
            <div style={{marginBottom:14}}>
              <select value={futureMonth} onChange={e=>setFutureMonth(e.target.value)} style={{width:'100%',padding:'8px 10px',fontSize:12,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC'}}>
                {futureMonthOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Resumo futuro */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              <div style={{background:'var(--danger-light)',border:'1px solid #FECACA',borderRadius:10,padding:'12px'}}>
                <div style={{fontSize:10,fontWeight:600,color:'var(--danger)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>Total a Pagar</div>
                <div style={{fontSize:18,fontWeight:800,color:'var(--danger)',fontFamily:'JetBrains Mono,monospace'}}>{formatBRL(futureTotal)}</div>
              </div>
              <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'12px'}}>
                <div style={{fontSize:10,fontWeight:600,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>Qtd de Contas</div>
                <div style={{fontSize:18,fontWeight:800,color:'var(--accent)',fontFamily:'JetBrains Mono,monospace'}}>{futureBills.filter(b=>b.status!=='paid').length}</div>
              </div>
            </div>

            {futureBills.length===0?(
              <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'36px',textAlign:'center',color:'var(--muted)'}}>
                <div style={{fontSize:28,marginBottom:8}}>🎉</div>
                <div style={{fontSize:13,fontWeight:600}}>Nenhuma conta neste período</div>
              </div>
            ):(
              <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
                {/* Header */}
                <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:8,padding:'8px 14px',background:'#F8FAFC',borderBottom:'1px solid var(--border)'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Conta</div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:'right'}}>Vencimento</div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:'right',minWidth:80}}>Valor</div>
                </div>
                {futureBills.map((b,i)=>{
                  const isPaid = b.status==='paid'
                  const isOver = b.live_status==='overdue'&&!isPaid
                  return (
                    <div key={b.id} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:8,padding:'11px 14px',borderBottom:i<futureBills.length-1?'1px solid #F8FAFC':'none',background:isPaid?'#F9FAFB':isOver?'#FFFAFA':'#fff',alignItems:'center'}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:isPaid?'var(--muted)':'var(--text)',textDecoration:isPaid?'line-through':'none'}}>{b.title}</div>
                        <div style={{display:'flex',gap:5,marginTop:2,flexWrap:'wrap'}}>
                          {b.category_name&&<span style={{fontSize:9,color:'var(--muted)'}}>{b.category_name}</span>}
                          {b.recurrence==='monthly'&&<span style={{fontSize:9,background:'#EFF6FF',color:'var(--accent)',padding:'1px 4px',borderRadius:6,fontWeight:600}}>Mensal</span>}
                          {isPaid&&<span style={{fontSize:9,background:'var(--success-light)',color:'var(--success)',padding:'1px 4px',borderRadius:6,fontWeight:600}}>✓ Pago</span>}
                          {isOver&&<span style={{fontSize:9,background:'var(--danger-light)',color:'var(--danger)',padding:'1px 4px',borderRadius:6,fontWeight:700}}>Vencida</span>}
                        </div>
                      </div>
                      <div style={{fontSize:11,color:'var(--muted)',fontWeight:500,whiteSpace:'nowrap',textAlign:'right'}}>{formatDate(b.due_date)}</div>
                      <div style={{fontSize:13,fontWeight:800,fontFamily:'JetBrains Mono,monospace',color:isPaid?'var(--success)':isOver?'var(--danger)':'var(--text)',textAlign:'right',minWidth:80,letterSpacing:'-0.3px'}}>{formatBRL(b.amount)}</div>
                    </div>
                  )
                })}
                {/* Rodapé total */}
                <div style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',background:'#F8FAFC',borderTop:'2px solid var(--border)'}}>
                  <span style={{fontSize:12,fontWeight:700,color:'var(--text)'}}>Total Pendente</span>
                  <span style={{fontSize:14,fontWeight:800,color:'var(--danger)',fontFamily:'JetBrains Mono,monospace'}}>{formatBRL(futureTotal)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
