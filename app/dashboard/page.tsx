'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Bill { id:string;title:string;amount:number;due_date:string;status:string;live_status:string;category_name:string;days_until_due:number }
interface Tx { id:string;title:string;amount:number;type:string;transaction_date:string;source:string;categories?:{name:string}|null }
interface Summary { total_expense:number;total_income:number;bills_pending:number;bills_overdue:number;bills_overdue_count:number }

function getMonthOptions() {
  const opts = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    opts.push({ value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) })
  }
  return opts
}

export default function Dashboard() {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [summary, setSummary] = useState<Summary>({ total_expense:0,total_income:0,bills_pending:0,bills_overdue:0,bills_overdue_count:0 })
  const [bills, setBills] = useState<Bill[]>([])
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [monthly, setMonthly] = useState<{month:string;despesas:number;receitas:number}[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showBillModal, setShowBillModal] = useState(false)
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])
  const [form, setForm] = useState({ title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',transaction_date:new Date().toISOString().split('T')[0] })
  const [billForm, setBillForm] = useState({ title:'',amount:'',due_date:'',category_id:'',recurrence:'once' })
  const [saving, setSaving] = useState(false)
  const monthOpts = getMonthOptions()

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { window.location.href='/'; return }
    const uid = user.id
    const mDate = new Date(selectedMonth)
    const mYear = mDate.getFullYear()
    const mMon = mDate.getMonth()
    const mStart = `${mYear}-${String(mMon+1).padStart(2,'0')}-01`
    const mEnd = new Date(mYear, mMon+1, 0).toISOString().split('T')[0]

    const [{ data:s },{ data:bl },{ data:tx },{ data:cats }] = await Promise.all([
      supabase.rpc('get_dashboard_summary', { p_user_id:uid, p_month:mStart }),
      // Contas APENAS do mês selecionado (due_date dentro do mês)
      supabase.from('bills_live').select('*').eq('user_id',uid)
        .gte('due_date', mStart).lte('due_date', mEnd)
        .neq('status','cancelled').order('due_date'),
      supabase.from('transactions').select('*,categories(name)').eq('user_id',uid)
        .gte('transaction_date', mStart).lte('transaction_date', mEnd)
        .order('transaction_date',{ascending:false}).limit(10),
      supabase.from('categories').select('id,name').or(`user_id.eq.${uid},user_id.is.null`).order('name'),
    ])
    setSummary(s||{ total_expense:0,total_income:0,bills_pending:0,bills_overdue:0,bills_overdue_count:0 })
    setBills(bl||[])
    setTransactions(tx||[])
    setCategories(cats||[])

    // Gráfico 6 meses
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth()-i)
      const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
      const { data:ms } = await supabase.from('monthly_summary').select('total_expense,total_income').eq('user_id',uid).eq('month',m).single()
      months.push({ month:d.toLocaleDateString('pt-BR',{month:'short'}), despesas:ms?.total_expense||0, receitas:ms?.total_income||0 })
    }
    setMonthly(months)
    setLoading(false)
  }, [selectedMonth])

  useEffect(() => { load() }, [load])

  async function saveTransaction() {
    if (!form.amount) return
    setSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').insert({ user_id:user.id, title:form.title||'Lançamento', amount:parseFloat(form.amount.replace(',','.')), type:form.type, status:'confirmed', category_id:form.category_id||null, payment_method:form.payment_method, transaction_date:form.transaction_date, source:'manual' })
    setShowModal(false)
    setForm({ title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',transaction_date:new Date().toISOString().split('T')[0] })
    setSaving(false); load()
  }

  async function saveBill() {
    if (!billForm.title || !billForm.amount || !billForm.due_date) return
    setSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bills').insert({ user_id:user.id, title:billForm.title, amount:parseFloat(billForm.amount.replace(',','.')), due_date:billForm.due_date, status:'pending', category_id:billForm.category_id||null, recurrence:billForm.recurrence, payment_method:'pix' })
    setShowBillModal(false)
    setBillForm({ title:'',amount:'',due_date:'',category_id:'',recurrence:'once' })
    setSaving(false); load()
  }

  async function markPaid(id: string) {
    await supabase.from('bills').update({ status:'paid' }).eq('id',id); load()
  }

  const totalContas = bills.filter(b=>b.status!=='paid').reduce((a,b)=>a+b.amount,0)
  const pagas = bills.filter(b=>b.status==='paid')
  const vencidas = bills.filter(b=>b.live_status==='overdue')
  const hoje = bills.filter(b=>b.live_status==='due_today')
  const proximas = bills.filter(b=>!['overdue','due_today','paid'].includes(b.live_status))
  const saldo = summary.total_income - summary.total_expense
  const isCurrentMonth = selectedMonth === currentMonth

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:12 }}>
      <div style={{ width:28,height:28,border:'3px solid #E5E9F2',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize:12,color:'var(--muted)',fontWeight:500 }}>Carregando...</span>
    </div>
  )

  return (
    <div>
      {/* TOPBAR */}
      <div style={{ background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 20px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50,boxShadow:'var(--shadow)' }}>
        <div>
          <div style={{ fontSize:16,fontWeight:700,letterSpacing:'-0.3px' }}>Dashboard</div>
          <div style={{ fontSize:11,color:'var(--muted)',fontWeight:500 }}>Visão geral financeira</div>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          {/* Seletor de mês */}
          <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={{ width:'auto',padding:'6px 10px',fontSize:12,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC',cursor:'pointer' }}>
            {monthOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={()=>setShowBillModal(true)} style={{ padding:'7px 14px',background:'#F1F5F9',color:'#334155',border:'1.5px solid var(--border)',borderRadius:8,fontSize:12,fontWeight:600 }}>+ Conta</button>
          <button onClick={()=>setShowModal(true)} style={{ padding:'7px 14px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600 }}>+ Lançamento</button>
        </div>
      </div>

      <div style={{ padding:'20px',maxWidth:1100 }}>

        {/* BADGE MÊS */}
        {!isCurrentMonth && (
          <div style={{ marginBottom:16,padding:'8px 14px',background:'#FFF7ED',border:'1px solid #FED7AA',borderRadius:8,fontSize:12,fontWeight:600,color:'#C2410C',display:'inline-flex',alignItems:'center',gap:6 }}>
            ⚠ Visualizando: {monthOpts.find(o=>o.value===selectedMonth)?.label}
          </div>
        )}

        {/* KPI CARDS */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
          {[
            { label:'Contas a Pagar', value:formatBRL(totalContas), sub:`${bills.filter(b=>b.status!=='paid').length} contas pendentes`, color:'var(--danger)', bg:'var(--danger-light)', icon:'📋' },
            { label:'Despesas Pagas', value:formatBRL(summary.total_expense), sub:'Lançamentos confirmados', color:'#1E40AF', bg:'#EFF6FF', icon:'💳' },
            { label:'Receitas', value:formatBRL(summary.total_income), sub:'Total do período', color:'var(--success)', bg:'var(--success-light)', icon:'💰' },
            { label:'Saldo Líquido', value:formatBRL(saldo), sub:saldo>=0?'Positivo no mês':'Atenção: negativo', color:saldo>=0?'var(--success)':'var(--danger)', bg:saldo>=0?'var(--success-light)':'var(--danger-light)', icon:saldo>=0?'📈':'📉' },
          ].map((c,i)=>(
            <div key={i} style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'16px',boxShadow:'var(--shadow)',borderLeft:`3px solid ${c.color}` }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
                <span style={{ fontSize:11,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px' }}>{c.label}</span>
                <span style={{ fontSize:18 }}>{c.icon}</span>
              </div>
              <div style={{ fontSize:20,fontWeight:800,color:c.color,fontFamily:'JetBrains Mono,monospace',letterSpacing:'-0.5px' }}>{c.value}</div>
              <div style={{ fontSize:11,color:'var(--muted)',marginTop:4,fontWeight:500 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:16 }}>
          {/* COLUNA ESQUERDA */}
          <div>
            {/* CONTAS DO MÊS */}
            <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:12,marginBottom:16,boxShadow:'var(--shadow)',overflow:'hidden' }}>
              <div style={{ padding:'14px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#FAFAFA' }}>
                <div>
                  <div style={{ fontSize:14,fontWeight:700 }}>Contas do Mês</div>
                  <div style={{ fontSize:11,color:'var(--muted)',marginTop:1 }}>
                    {bills.length} contas · {formatBRL(totalContas)} pendente
                  </div>
                </div>
                <a href="/bills" style={{ fontSize:12,fontWeight:600,color:'var(--accent)',textDecoration:'none' }}>Ver todas →</a>
              </div>

              {bills.length === 0 ? (
                <div style={{ padding:'32px',textAlign:'center',color:'var(--muted)' }}>
                  <div style={{ fontSize:32,marginBottom:8 }}>🎉</div>
                  <div style={{ fontSize:13,fontWeight:600 }}>Sem contas neste mês</div>
                  <button onClick={()=>setShowBillModal(true)} style={{ marginTop:12,padding:'6px 16px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600 }}>Adicionar conta</button>
                </div>
              ) : (
                <>
                  {vencidas.length>0 && <BillSection title="⚠ Vencidas" color="var(--danger)" bg="#FFF1F1" bills={vencidas} onPay={markPaid}/>}
                  {hoje.length>0 && <BillSection title="🔔 Vence hoje" color="var(--warning)" bg="#FFFBEB" bills={hoje} onPay={markPaid}/>}
                  {proximas.length>0 && <BillSection title="📋 Próximas" color="#475569" bg="#F8FAFC" bills={proximas} onPay={markPaid}/>}
                  {pagas.length>0 && <BillSection title="✅ Pagas" color="var(--success)" bg="#F0FDF4" bills={pagas} onPay={markPaid} paid/>}
                </>
              )}
            </div>

            {/* ÚLTIMOS LANÇAMENTOS */}
            <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:12,boxShadow:'var(--shadow)',overflow:'hidden' }}>
              <div style={{ padding:'14px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#FAFAFA' }}>
                <div style={{ fontSize:14,fontWeight:700 }}>Lançamentos do Mês</div>
                <a href="/transactions" style={{ fontSize:12,fontWeight:600,color:'var(--accent)',textDecoration:'none' }}>Ver todos →</a>
              </div>
              {transactions.length===0 ? (
                <div style={{ padding:'24px',textAlign:'center',color:'var(--muted)',fontSize:13 }}>Nenhum lançamento neste período</div>
              ) : transactions.map(t=>(
                <div key={t.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderBottom:'1px solid #F8FAFC' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                    <div style={{ width:34,height:34,borderRadius:9,background:t.type==='income'?'var(--success-light)':'var(--danger-light)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0 }}>{t.type==='income'?'↑':'↓'}</div>
                    <div>
                      <div style={{ fontSize:13,fontWeight:600 }}>{t.title}{t.source==='whatsapp'&&<span style={{ fontSize:10,background:'#ECFDF5',color:'#065F46',padding:'1px 6px',borderRadius:8,fontWeight:700,marginLeft:6 }}>TG</span>}</div>
                      <div style={{ fontSize:11,color:'var(--muted)',fontWeight:500 }}>{formatDate(t.transaction_date)} · {(t.categories as {name:string}|null)?.name||'—'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize:13,fontWeight:700,fontFamily:'JetBrains Mono,monospace',color:t.type==='income'?'var(--success)':'var(--danger)',letterSpacing:'-0.3px' }}>{t.type==='income'?'+':'-'}{formatBRL(t.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* COLUNA DIREITA */}
          <div>
            {/* GRÁFICO */}
            <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'16px',marginBottom:16,boxShadow:'var(--shadow)' }}>
              <div style={{ fontSize:13,fontWeight:700,marginBottom:4 }}>Tendência 6 Meses</div>
              <div style={{ fontSize:11,color:'var(--muted)',marginBottom:14 }}>Receitas vs Despesas</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={monthly}>
                  <XAxis dataKey="month" tick={{ fontSize:10,fill:'#9CA3AF',fontFamily:'Inter' }} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip formatter={(v:number)=>formatBRL(v)} contentStyle={{ fontSize:11,borderRadius:8,border:'1px solid var(--border)',boxShadow:'var(--shadow-md)' }}/>
                  <Area type="monotone" dataKey="receitas" stroke="var(--success)" fill="#DCFCE7" strokeWidth={2} name="Receitas"/>
                  <Area type="monotone" dataKey="despesas" stroke="var(--danger)" fill="#FEE2E2" strokeWidth={2} name="Despesas"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* RESUMO RÁPIDO */}
            <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'16px',boxShadow:'var(--shadow)' }}>
              <div style={{ fontSize:13,fontWeight:700,marginBottom:14 }}>Resumo do Período</div>
              {[
                { label:'Total a pagar', value:formatBRL(totalContas), color:'var(--danger)' },
                { label:'Contas pagas', value:`${pagas.length} de ${bills.length}`, color:'var(--success)' },
                { label:'Em atraso', value:`${vencidas.length} conta${vencidas.length!==1?'s':''}`, color:vencidas.length>0?'var(--danger)':'var(--muted)' },
                { label:'Receita total', value:formatBRL(summary.total_income), color:'var(--success)' },
                { label:'Despesas', value:formatBRL(summary.total_expense), color:'#1E40AF' },
                { label:'Saldo', value:formatBRL(saldo), color:saldo>=0?'var(--success)':'var(--danger)' },
              ].map((r,i)=>(
                <div key={i} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:i<5?'1px solid #F8FAFC':'none' }}>
                  <span style={{ fontSize:12,color:'var(--muted)',fontWeight:500 }}>{r.label}</span>
                  <span style={{ fontSize:13,fontWeight:700,color:r.color,fontFamily:'JetBrains Mono,monospace',letterSpacing:'-0.3px' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL LANÇAMENTO */}
      {showModal && <Modal title="Novo Lançamento" onClose={()=>setShowModal(false)}>
        <div style={{ display:'flex',gap:4,background:'#F1F5F9',padding:4,borderRadius:8,marginBottom:14 }}>
          {[{v:'expense',l:'💳 Despesa'},{v:'income',l:'💰 Receita'}].map(t=>(
            <button key={t.v} onClick={()=>setForm(f=>({...f,type:t.v}))} style={{ flex:1,padding:'7px',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:600,background:form.type===t.v?'#fff':'transparent',color:form.type===t.v?'var(--text)':'var(--muted)',boxShadow:form.type===t.v?'var(--shadow)':'none' }}>{t.l}</button>
          ))}
        </div>
        <FG label="Descrição"><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Mercado, Gasolina..."/></FG>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
          <FG label="Valor (R$)"><input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></FG>
          <FG label="Data"><input type="date" value={form.transaction_date} onChange={e=>setForm(f=>({...f,transaction_date:e.target.value}))}/></FG>
        </div>
        <FG label="Categoria"><select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}><option value="">Selecionar...</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></FG>
        <FG label="Pagamento"><select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}><option value="pix">PIX</option><option value="debit">Débito</option><option value="credit">Crédito</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option></select></FG>
        <BtnRow onCancel={()=>setShowModal(false)} onSave={saveTransaction} saving={saving} label="Salvar Lançamento"/>
      </Modal>}

      {/* MODAL CONTA */}
      {showBillModal && <Modal title="Nova Conta a Pagar" onClose={()=>setShowBillModal(false)}>
        <FG label="Nome da Conta"><input value={billForm.title} onChange={e=>setBillForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Aluguel, Energia..."/></FG>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
          <FG label="Valor (R$)"><input value={billForm.amount} onChange={e=>setBillForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></FG>
          <FG label="Vencimento"><input type="date" value={billForm.due_date} onChange={e=>setBillForm(f=>({...f,due_date:e.target.value}))}/></FG>
        </div>
        <FG label="Categoria"><select value={billForm.category_id} onChange={e=>setBillForm(f=>({...f,category_id:e.target.value}))}><option value="">Selecionar...</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></FG>
        <FG label="Recorrência"><select value={billForm.recurrence} onChange={e=>setBillForm(f=>({...f,recurrence:e.target.value}))}><option value="once">Única vez</option><option value="monthly">Mensal</option><option value="yearly">Anual</option><option value="weekly">Semanal</option></select></FG>
        <BtnRow onCancel={()=>setShowBillModal(false)} onSave={saveBill} saving={saving} label="Salvar Conta"/>
      </Modal>}

      <style>{`
        @media(max-width:768px){
          .main-content>div>div:last-child { grid-template-columns: 1fr !important; }
          .main-content>div>div:nth-child(3) { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  )
}

function BillSection({ title, color, bg, bills, onPay, paid }:{ title:string, color:string, bg:string, bills:any[], onPay:(id:string)=>void, paid?:boolean }) {
  return (
    <div>
      <div style={{ padding:'7px 16px',background:bg,fontSize:11,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.5px',borderBottom:'1px solid var(--border)' }}>{title}</div>
      {bills.map(b=>(
        <div key={b.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderBottom:'1px solid #F8FAFC' }}>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:paid?'var(--muted)':'var(--text)',textDecoration:paid?'line-through':'none' }}>{b.title}</div>
            <div style={{ fontSize:11,color:'var(--muted)',marginTop:2,fontWeight:500 }}>{b.category_name||'—'} · {formatDate(b.due_date)}</div>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8,flexShrink:0,marginLeft:12 }}>
            <span style={{ fontSize:13,fontWeight:700,fontFamily:'JetBrains Mono,monospace',color:paid?'var(--success)':b.live_status==='overdue'?'var(--danger)':'var(--text)',letterSpacing:'-0.3px' }}>{formatBRL(b.amount)}</span>
            {!paid && <button onClick={()=>onPay(b.id)} style={{ padding:'4px 10px',background:'var(--success-light)',color:'var(--success)',border:'1px solid #BBF7D0',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700 }}>Pagar</button>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Modal({ title, children, onClose }:{ title:string, children:React.ReactNode, onClose:()=>void }) {
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose() }} style={{ position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center',backdropFilter:'blur(2px)' }}>
      <div style={{ background:'#fff',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:520,maxHeight:'92vh',overflowY:'auto',padding:'20px 20px 32px',boxShadow:'0 -8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
          <div style={{ fontSize:15,fontWeight:700 }}>{title}</div>
          <button onClick={onClose} style={{ background:'#F1F5F9',border:'none',borderRadius:8,width:28,height:28,cursor:'pointer',fontSize:14,color:'var(--muted)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FG({ label, children }:{ label:string, children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>{label}</label>
      {children}
    </div>
  )
}

function BtnRow({ onCancel, onSave, saving, label }:{ onCancel:()=>void, onSave:()=>void, saving:boolean, label:string }) {
  return (
    <div style={{ display:'flex',gap:8,marginTop:8 }}>
      <button onClick={onCancel} style={{ flex:1,padding:11,border:'1.5px solid var(--border)',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--muted)' }}>Cancelar</button>
      <button onClick={onSave} disabled={saving} style={{ flex:2,padding:11,background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,opacity:saving?0.7:1 }}>{saving?'Salvando...':label}</button>
    </div>
  )
}
