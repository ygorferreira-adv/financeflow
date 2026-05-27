'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

interface Summary { total_expense:number; total_income:number; bills_pending:number; bills_overdue:number; bills_overdue_count:number }
interface Transaction { id:string; title:string; amount:number; type:string; transaction_date:string; source:string; categories?:{name:string;color:string} }
interface Bill { id:string; title:string; amount:number; due_date:string; status:string; live_status:string; category_name:string }

const COLORS = ['#2563EB','#D97706','#16A34A','#CA8A04','#DC2626','#7C3AED','#0369A1','#94A3B8']

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary|null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [catData, setCatData] = useState<{name:string;value:number}[]>([])
  const [monthlyData, setMonthlyData] = useState<{month:string;despesas:number;receitas:number}[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title:'', amount:'', type:'expense', category_id:'', payment_method:'pix', transaction_date: new Date().toISOString().split('T')[0] })
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href='/'; return }
    const uid = user.id

    const [{ data: s }, { data: tx }, { data: bl }, { data: cm }, { data: cats }] = await Promise.all([
      supabase.rpc('get_dashboard_summary', { p_user_id: uid }),
      supabase.from('transactions').select('*, categories(name,color)').eq('user_id', uid).order('transaction_date', { ascending:false }).limit(6),
      supabase.from('bills_live').select('*').eq('user_id', uid).neq('status','paid').order('due_date').limit(5),
      supabase.from('category_monthly').select('*').eq('user_id', uid).order('total', { ascending:false }).limit(6),
      supabase.from('categories').select('id,name').or(`user_id.eq.${uid},user_id.is.null`).order('name'),
    ])

    setSummary(s as Summary)
    setTransactions(tx || [])
    setBills(bl || [])
    setCatData((cm||[]).map((r:{ category_name:string; total:number }) => ({ name: r.category_name || 'Outros', value: Number(r.total) })))
    setCategories(cats || [])

    // Monthly chart — últimos 5 meses
    const months: {month:string;despesas:number;receitas:number}[] = []
    for (let i = 4; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
      const { data: ms } = await supabase.from('monthly_summary').select('total_expense,total_income').eq('user_id', uid).eq('month', m).single()
      months.push({ month: d.toLocaleDateString('pt-BR', { month:'short' }), despesas: ms?.total_expense || 0, receitas: ms?.total_income || 0 })
    }
    setMonthlyData(months)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addTransaction() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').insert({
      user_id: user.id, title: form.title,
      amount: parseFloat(form.amount.replace(',','.')),
      type: form.type, status: 'confirmed',
      category_id: form.category_id || null,
      payment_method: form.payment_method,
      transaction_date: form.transaction_date,
      source: 'manual'
    })
    setShowModal(false)
    setForm({ title:'', amount:'', type:'expense', category_id:'', payment_method:'pix', transaction_date: new Date().toISOString().split('T')[0] })
    load()
  }

  const statCards = [
    { label:'Despesa Total', value: formatBRL(summary?.total_expense||0), color:'#2563EB', bg:'#EFF4FF' },
    { label:'Total Pago', value: formatBRL((summary?.total_expense||0)-(summary?.bills_pending||0)), color:'#16A34A', bg:'#DCFCE7' },
    { label:'Pendente', value: formatBRL(summary?.bills_pending||0), color:'#D97706', bg:'#FFFBEB' },
    { label:'Vencidas', value: formatBRL(summary?.bills_overdue||0), color:'#DC2626', bg:'#FEF2F2', sub:`${summary?.bills_overdue_count||0} contas` },
  ]

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#9AA3B2' }}>Carregando...</div>

  return (
    <div style={{ padding:'0 0 40px' }}>
      {/* Topbar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #E5E9F2', padding:'0 28px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700 }}>Dashboard</div>
          <div style={{ fontSize:12, color:'#9AA3B2' }}>{new Date().toLocaleDateString('pt-BR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <a href="/reports" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', border:'1px solid #CDD3E0', borderRadius:6, fontSize:13, fontWeight:600, color:'#5A6478', textDecoration:'none', background:'#fff' }}>Relatórios</a>
          <button onClick={()=>setShowModal(true)} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 16px', background:'#2563EB', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>+ Nova Despesa</button>
        </div>
      </div>

      <div style={{ padding:'24px 28px' }}>
        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:20 }}>
          {statCards.map((s,i) => (
            <div key={i} className="card" style={{ padding:'20px 22px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:s.color, borderRadius:2 }}/>
              <div style={{ width:40, height:40, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                <span style={{ fontSize:18 }}>{i===0?'📊':i===1?'✅':i===2?'⏳':'⚠️'}</span>
              </div>
              <div style={{ fontSize:11, color:'#9AA3B2', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{s.label}</div>
              <div className="mono" style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>{s.value}</div>
              {s.sub && <div style={{ fontSize:11, color:'#9AA3B2', marginTop:4 }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
          <div className="card" style={{ padding:'20px 24px' }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Gastos por Categoria</div>
            {catData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3}>
                    {catData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v:number)=>formatBRL(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#9AA3B2', fontSize:13 }}>Sem dados este mês</div>}
          </div>
          <div className="card" style={{ padding:'20px 24px' }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Evolução Mensal</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'#9AA3B2' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:'#9AA3B2' }} axisLine={false} tickLine={false} tickFormatter={v=>formatBRL(v).replace('R$','R$')} width={80} />
                <Tooltip formatter={(v:number)=>formatBRL(v)} />
                <Area type="monotone" dataKey="despesas" stroke="#DC2626" fill="#FEF2F2" strokeWidth={2} name="Despesas" />
                <Area type="monotone" dataKey="receitas" stroke="#16A34A" fill="#DCFCE7" strokeWidth={2} name="Receitas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bills + Transactions */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div className="card" style={{ padding:'20px 24px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:700 }}>Próximas Contas</div>
              <a href="/bills" style={{ fontSize:12, fontWeight:600, color:'#2563EB', textDecoration:'none' }}>Ver todas →</a>
            </div>
            {bills.length === 0 ? <div style={{ textAlign:'center', padding:'32px', color:'#9AA3B2', fontSize:13 }}>🎉 Todas as contas pagas!</div> : bills.map(b => (
              <div key={b.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #E5E9F2' }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13.5 }}>{b.title}</div>
                  <div style={{ fontSize:11, color:'#9AA3B2' }}>Vence {formatDate(b.due_date)} · {b.category_name||'—'}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div className="mono" style={{ fontWeight:700, color: b.live_status==='overdue'?'#DC2626':'#0D1117' }}>{formatBRL(b.amount)}</div>
                  <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background: b.live_status==='overdue'?'#FEF2F2':b.live_status==='due_today'?'#FEF9C3':'#FFFBEB', color: b.live_status==='overdue'?'#DC2626':b.live_status==='due_today'?'#A16207':'#D97706' }}>
                    {b.live_status==='overdue'?'Vencida':b.live_status==='due_today'?'Vence hoje':'Pendente'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding:'20px 24px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:700 }}>Últimos Lançamentos</div>
              <a href="/transactions" style={{ fontSize:12, fontWeight:600, color:'#2563EB', textDecoration:'none' }}>Ver todos →</a>
            </div>
            {transactions.map(t => (
              <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #E5E9F2' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:'#F0F2F7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                    {t.type==='income'?'💵':'💸'}
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13 }}>
                      {t.title}
                      {t.source==='whatsapp' && <span style={{ fontSize:10, background:'#DCFCE7', color:'#15803D', padding:'1px 5px', borderRadius:10, fontWeight:700, marginLeft:5 }}>WA</span>}
                    </div>
                    <div style={{ fontSize:11, color:'#9AA3B2' }}>{formatDate(t.transaction_date)} · {(t.categories as {name:string}|null)?.name||'—'}</div>
                  </div>
                </div>
                <div className={t.type==='income'?'amt-pos':'amt-neg'}>{t.type==='income'?'+':'-'}{formatBRL(t.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div onClick={e=>{ if(e.target===e.currentTarget) setShowModal(false) }} style={{ position:'fixed', inset:0, background:'rgba(13,17,23,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:16, width:480, maxWidth:'95vw', padding:28, boxShadow:'0 24px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:700 }}>Novo Lançamento</div>
              <button onClick={()=>setShowModal(false)} style={{ background:'#F0F2F7', border:'none', borderRadius:6, width:32, height:32, cursor:'pointer', fontSize:16 }}>✕</button>
            </div>
            <div style={{ display:'flex', gap:4, background:'#F0F2F7', padding:4, borderRadius:9, marginBottom:16 }}>
              {[{v:'expense',l:'Despesa'},{v:'income',l:'Receita'}].map(t=>(
                <button key={t.v} onClick={()=>setForm(f=>({...f,type:t.v}))} style={{ flex:1, padding:'7px 0', border:'none', borderRadius:7, cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:600, background:form.type===t.v?'#fff':'transparent', color:form.type===t.v?'#0D1117':'#9AA3B2', boxShadow:form.type===t.v?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>{t.l}</button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Valor</label><input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" /></div>
              <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Data</label><input type="date" value={form.transaction_date} onChange={e=>setForm(f=>({...f,transaction_date:e.target.value}))} /></div>
            </div>
            <div style={{ marginBottom:12 }}><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Descrição</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Mercado, Gasolina..." /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Categoria</label>
                <select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}>
                  <option value="">Selecionar...</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Pagamento</label>
                <select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}>
                  <option value="pix">PIX</option><option value="debit">Débito</option><option value="credit">Crédito</option><option value="cash">Dinheiro</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setShowModal(false)} style={{ flex:1, padding:11, border:'1px solid #CDD3E0', borderRadius:8, background:'#fff', cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:600, color:'#5A6478' }}>Cancelar</button>
              <button onClick={addTransaction} style={{ flex:2, padding:11, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:600 }}>Salvar Lançamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
