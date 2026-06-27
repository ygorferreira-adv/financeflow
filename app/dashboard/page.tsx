'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Bill { id:string;title:string;amount:number;due_date:string;status:string;live_status:string;category_name:string;days_until_due:number }
interface Transaction { id:string;title:string;amount:number;type:string;transaction_date:string;source:string;categories?:{name:string}|null }
interface Summary { total_expense:number;total_income:number;bills_pending:number;bills_overdue:number;bills_overdue_count:number }

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary>({ total_expense:0,total_income:0,bills_pending:0,bills_overdue:0,bills_overdue_count:0 })
  const [bills, setBills] = useState<Bill[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [monthly, setMonthly] = useState<{month:string;despesas:number;receitas:number}[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showBillModal, setShowBillModal] = useState(false)
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])
  const [form, setForm] = useState({ title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',transaction_date:new Date().toISOString().split('T')[0] })
  const [billForm, setBillForm] = useState({ title:'',amount:'',due_date:'',category_id:'',recurrence:'once' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { window.location.href='/'; return }
    const uid = user.id
    const [{ data:s },{ data:bl },{ data:tx },{ data:cats }] = await Promise.all([
      supabase.rpc('get_dashboard_summary',{ p_user_id:uid }),
      supabase.from('bills_live').select('*').eq('user_id',uid).neq('status','paid').neq('status','cancelled').order('due_date').limit(20),
      supabase.from('transactions').select('*,categories(name)').eq('user_id',uid).order('transaction_date',{ascending:false}).limit(8),
      supabase.from('categories').select('id,name').or(`user_id.eq.${uid},user_id.is.null`).order('name'),
    ])
    setSummary(s||{ total_expense:0,total_income:0,bills_pending:0,bills_overdue:0,bills_overdue_count:0 })
    setBills(bl||[])
    setTransactions(tx||[])
    setCategories(cats||[])
    const months=[]
    for(let i=4;i>=0;i--){
      const d=new Date(); d.setMonth(d.getMonth()-i)
      const m=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
      const { data:ms } = await supabase.from('monthly_summary').select('total_expense,total_income').eq('user_id',uid).eq('month',m).single()
      months.push({ month:d.toLocaleDateString('pt-BR',{month:'short'}), despesas:ms?.total_expense||0, receitas:ms?.total_income||0 })
    }
    setMonthly(months)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveTransaction() {
    setSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').insert({
      user_id:user.id, title:form.title||'Lançamento',
      amount:parseFloat(form.amount.replace(',','.')),
      type:form.type, status:'confirmed',
      category_id:form.category_id||null,
      payment_method:form.payment_method,
      transaction_date:form.transaction_date, source:'manual'
    })
    setShowModal(false)
    setForm({ title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',transaction_date:new Date().toISOString().split('T')[0] })
    setSaving(false); load()
  }

  async function saveBill() {
    setSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bills').insert({
      user_id:user.id, title:billForm.title,
      amount:parseFloat(billForm.amount.replace(',','.')),
      due_date:billForm.due_date, status:'pending',
      category_id:billForm.category_id||null,
      recurrence:billForm.recurrence, payment_method:'pix'
    })
    setShowBillModal(false)
    setBillForm({ title:'',amount:'',due_date:'',category_id:'',recurrence:'once' })
    setSaving(false); load()
  }

  async function markPaid(id:string) {
    await supabase.from('bills').update({ status:'paid' }).eq('id',id)
    load()
  }

  const statusColor = (s:string) => s==='overdue'?'#DC2626':s==='due_today'?'#D97706':'#2563EB'
  const statusBg = (s:string) => s==='overdue'?'#FEF2F2':s==='due_today'?'#FFFBEB':'#EFF4FF'
  const statusLabel = (s:string,days:number) => s==='overdue'?'Vencida':s==='due_today'?'Hoje':s==='due_soon'?`${days}d`:formatDate(bills.find(b=>b.live_status===s)?.due_date||'')

  const totalMes = bills.reduce((a,b)=>a+b.amount,0)
  const vencidas = bills.filter(b=>b.live_status==='overdue')
  const hoje = bills.filter(b=>b.live_status==='due_today')
  const proximas = bills.filter(b=>!['overdue','due_today'].includes(b.live_status))

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12 }}>
      <div style={{ width:32,height:32,border:'3px solid #E5E9F2',borderTopColor:'#2563EB',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize:13,color:'#9AA3B2' }}>Carregando...</span>
    </div>
  )

  return (
    <div>
      {/* TOPBAR */}
      <div style={{ background:'#fff',borderBottom:'1px solid #E5E9F2',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50 }}>
        <div>
          <div style={{ fontSize:15,fontWeight:700 }}>Dashboard</div>
          <div style={{ fontSize:11,color:'#9AA3B2' }}>{new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</div>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button onClick={()=>setShowBillModal(true)} style={{ padding:'6px 12px',background:'#F0F2F7',color:'#5A6478',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans,sans-serif' }}>+ Conta</button>
          <button onClick={()=>setShowModal(true)} style={{ padding:'6px 12px',background:'#2563EB',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans,sans-serif' }}>+ Despesa</button>
        </div>
      </div>

      <div style={{ padding:'16px' }}>

        {/* CARDS RESUMO */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16 }}>
          {[
            { label:'A Pagar este mês',value:formatBRL(totalMes),color:'#DC2626',bg:'#FEF2F2',icon:'📋' },
            { label:'Vencidas',value:`${vencidas.length} contas`,sub:formatBRL(summary.bills_overdue),color:'#B91C1C',bg:'#FEE2E2',icon:'⚠️' },
            { label:'Receitas',value:formatBRL(summary.total_income),color:'#16A34A',bg:'#DCFCE7',icon:'💰' },
            { label:'Despesas pagas',value:formatBRL(summary.total_expense),color:'#2563EB',bg:'#EFF4FF',icon:'✅' },
          ].map((c,i)=>(
            <div key={i} style={{ background:c.bg,borderRadius:12,padding:'14px 14px' }}>
              <div style={{ fontSize:18,marginBottom:4 }}>{c.icon}</div>
              <div style={{ fontSize:11,color:c.color,fontWeight:600,marginBottom:2 }}>{c.label}</div>
              <div style={{ fontSize:18,fontWeight:700,color:c.color,fontFamily:'DM Mono,monospace',letterSpacing:'-0.5px' }}>{c.value}</div>
              {c.sub && <div style={{ fontSize:11,color:c.color,opacity:0.8,marginTop:2 }}>{c.sub}</div>}
            </div>
          ))}
        </div>

        {/* CONTAS DO MÊS */}
        <div style={{ background:'#fff',border:'1px solid #E5E9F2',borderRadius:14,marginBottom:16,overflow:'hidden' }}>
          <div style={{ padding:'14px 16px',borderBottom:'1px solid #E5E9F2',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:14,fontWeight:700 }}>Contas do Mês</div>
              <div style={{ fontSize:11,color:'#9AA3B2',marginTop:1 }}>{bills.length} contas · Total {formatBRL(totalMes)}</div>
            </div>
            <a href="/bills" style={{ fontSize:12,fontWeight:600,color:'#2563EB',textDecoration:'none' }}>Ver todas →</a>
          </div>

          {bills.length === 0 ? (
            <div style={{ padding:'32px',textAlign:'center',color:'#9AA3B2',fontSize:13 }}>
              🎉 Nenhuma conta pendente!<br/>
              <button onClick={()=>setShowBillModal(true)} style={{ marginTop:10,padding:'6px 14px',background:'#2563EB',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans,sans-serif' }}>Adicionar conta</button>
            </div>
          ) : (
            <div>
              {/* Vencidas */}
              {vencidas.length > 0 && (
                <div>
                  <div style={{ padding:'8px 16px',background:'#FEF2F2',fontSize:11,fontWeight:600,color:'#DC2626',textTransform:'uppercase',letterSpacing:'0.5px' }}>⚠️ Vencidas — pague agora</div>
                  {vencidas.map(b=>(<BillRow key={b.id} b={b} onPay={markPaid}/>))}
                </div>
              )}
              {/* Hoje */}
              {hoje.length > 0 && (
                <div>
                  <div style={{ padding:'8px 16px',background:'#FFFBEB',fontSize:11,fontWeight:600,color:'#D97706',textTransform:'uppercase',letterSpacing:'0.5px' }}>📅 Vence hoje</div>
                  {hoje.map(b=>(<BillRow key={b.id} b={b} onPay={markPaid}/>))}
                </div>
              )}
              {/* Próximas */}
              {proximas.length > 0 && (
                <div>
                  <div style={{ padding:'8px 16px',background:'#F8F9FC',fontSize:11,fontWeight:600,color:'#5A6478',textTransform:'uppercase',letterSpacing:'0.5px' }}>📋 Próximas</div>
                  {proximas.map(b=>(<BillRow key={b.id} b={b} onPay={markPaid}/>))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* GRÁFICO */}
        {monthly.some(m=>m.despesas>0||m.receitas>0) && (
          <div style={{ background:'#fff',border:'1px solid #E5E9F2',borderRadius:14,padding:'16px',marginBottom:16 }}>
            <div style={{ fontSize:14,fontWeight:700,marginBottom:12 }}>Evolução 5 meses</div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={monthly}>
                <XAxis dataKey="month" tick={{ fontSize:11,fill:'#9AA3B2' }} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip formatter={(v:number)=>formatBRL(v)}/>
                <Area type="monotone" dataKey="despesas" stroke="#DC2626" fill="#FEE2E2" strokeWidth={2} name="Despesas"/>
                <Area type="monotone" dataKey="receitas" stroke="#16A34A" fill="#DCFCE7" strokeWidth={2} name="Receitas"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ÚLTIMOS LANÇAMENTOS */}
        {transactions.length > 0 && (
          <div style={{ background:'#fff',border:'1px solid #E5E9F2',borderRadius:14,overflow:'hidden' }}>
            <div style={{ padding:'14px 16px',borderBottom:'1px solid #E5E9F2',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ fontSize:14,fontWeight:700 }}>Últimos Lançamentos</div>
              <a href="/transactions" style={{ fontSize:12,fontWeight:600,color:'#2563EB',textDecoration:'none' }}>Ver todos →</a>
            </div>
            {transactions.map(t=>(
              <div key={t.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderBottom:'1px solid #F0F2F7' }}>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <div style={{ width:32,height:32,borderRadius:8,background:t.type==='income'?'#DCFCE7':'#FEF2F2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0 }}>{t.type==='income'?'💵':'💸'}</div>
                  <div>
                    <div style={{ fontSize:13,fontWeight:600 }}>{t.title}{t.source==='whatsapp'&&<span style={{ fontSize:10,background:'#DCFCE7',color:'#15803D',padding:'1px 5px',borderRadius:10,fontWeight:700,marginLeft:5 }}>TG</span>}</div>
                    <div style={{ fontSize:11,color:'#9AA3B2' }}>{formatDate(t.transaction_date)} · {(t.categories as {name:string}|null)?.name||'—'}</div>
                  </div>
                </div>
                <span style={{ fontSize:13,fontWeight:700,fontFamily:'DM Mono,monospace',color:t.type==='income'?'#16A34A':'#DC2626' }}>{t.type==='income'?'+':'-'}{formatBRL(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DESPESA */}
      {showModal && (
        <Modal title="Nova Despesa" onClose={()=>setShowModal(false)}>
          <div style={{ display:'flex',gap:4,background:'#F0F2F7',padding:4,borderRadius:8,marginBottom:14 }}>
            {[{v:'expense',l:'Despesa'},{v:'income',l:'Receita'}].map(t=>(
              <button key={t.v} onClick={()=>setForm(f=>({...f,type:t.v}))} style={{ flex:1,padding:'6px',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:600,background:form.type===t.v?'#fff':'transparent',color:form.type===t.v?'#0D1117':'#9AA3B2' }}>{t.l}</button>
            ))}
          </div>
          <FGroup label="Descrição"><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Mercado, Gasolina..."/></FGroup>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            <FGroup label="Valor"><input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></FGroup>
            <FGroup label="Data"><input type="date" value={form.transaction_date} onChange={e=>setForm(f=>({...f,transaction_date:e.target.value}))}/></FGroup>
          </div>
          <FGroup label="Categoria">
            <select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}>
              <option value="">Selecionar...</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FGroup>
          <FGroup label="Pagamento">
            <select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}>
              <option value="pix">PIX</option><option value="debit">Débito</option><option value="credit">Crédito</option><option value="cash">Dinheiro</option>
            </select>
          </FGroup>
          <BtnRow onCancel={()=>setShowModal(false)} onSave={saveTransaction} saving={saving} label="Salvar Lançamento"/>
        </Modal>
      )}

      {/* MODAL CONTA */}
      {showBillModal && (
        <Modal title="Nova Conta a Pagar" onClose={()=>setShowBillModal(false)}>
          <FGroup label="Nome da Conta"><input value={billForm.title} onChange={e=>setBillForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Aluguel, Energia..."/></FGroup>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            <FGroup label="Valor"><input value={billForm.amount} onChange={e=>setBillForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></FGroup>
            <FGroup label="Vencimento"><input type="date" value={billForm.due_date} onChange={e=>setBillForm(f=>({...f,due_date:e.target.value}))}/></FGroup>
          </div>
          <FGroup label="Categoria">
            <select value={billForm.category_id} onChange={e=>setBillForm(f=>({...f,category_id:e.target.value}))}>
              <option value="">Selecionar...</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FGroup>
          <FGroup label="Recorrência">
            <select value={billForm.recurrence} onChange={e=>setBillForm(f=>({...f,recurrence:e.target.value}))}>
              <option value="once">Única</option><option value="monthly">Mensal</option><option value="yearly">Anual</option>
            </select>
          </FGroup>
          <BtnRow onCancel={()=>setShowBillModal(false)} onSave={saveBill} saving={saving} label="Salvar Conta"/>
        </Modal>
      )}
    </div>
  )
}

function BillRow({ b, onPay }:{ b:Bill, onPay:(id:string)=>void }) {
  const isOverdue = b.live_status==='overdue'
  const isToday = b.live_status==='due_today'
  return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid #F0F2F7' }}>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:13,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{b.title}</div>
        <div style={{ fontSize:11,color:'#9AA3B2',marginTop:2 }}>
          {b.category_name||'—'} · Vence {formatDate(b.due_date)}
          {isOverdue && <span style={{ color:'#DC2626',fontWeight:600 }}> · VENCIDA</span>}
          {isToday && <span style={{ color:'#D97706',fontWeight:600 }}> · HOJE</span>}
        </div>
      </div>
      <div style={{ display:'flex',alignItems:'center',gap:8,flexShrink:0,marginLeft:10 }}>
        <span style={{ fontSize:14,fontWeight:700,fontFamily:'DM Mono,monospace',color:isOverdue?'#DC2626':'#0D1117' }}>{formatBRL(b.amount)}</span>
        <button onClick={()=>onPay(b.id)} style={{ padding:'4px 10px',background:'#DCFCE7',color:'#16A34A',border:'none',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'DM Sans,sans-serif',whiteSpace:'nowrap' }}>Pagar</button>
      </div>
    </div>
  )
}

function Modal({ title, children, onClose }:{ title:string, children:React.ReactNode, onClose:()=>void }) {
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose() }} style={{ position:'fixed',inset:0,background:'rgba(13,17,23,0.5)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center' }}>
      <div style={{ background:'#fff',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:600,maxHeight:'90vh',overflowY:'auto',padding:'20px 16px 32px' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <div style={{ fontSize:16,fontWeight:700 }}>{title}</div>
          <button onClick={onClose} style={{ background:'#F0F2F7',border:'none',borderRadius:8,width:30,height:30,cursor:'pointer',fontSize:16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FGroup({ label, children }:{ label:string, children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:'block',fontSize:11,fontWeight:600,color:'#5A6478',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.4px' }}>{label}</label>
      {children}
    </div>
  )
}

function BtnRow({ onCancel,onSave,saving,label }:{ onCancel:()=>void,onSave:()=>void,saving:boolean,label:string }) {
  return (
    <div style={{ display:'flex',gap:8,marginTop:4 }}>
      <button onClick={onCancel} style={{ flex:1,padding:11,border:'1px solid #CDD3E0',borderRadius:8,background:'#fff',cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:600,color:'#5A6478' }}>Cancelar</button>
      <button onClick={onSave} disabled={saving} style={{ flex:2,padding:11,background:'#2563EB',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:600,opacity:saving?0.7:1 }}>{saving?'Salvando...':label}</button>
    </div>
  )
}
