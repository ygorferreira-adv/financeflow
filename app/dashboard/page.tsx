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
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
    opts.push({ value:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, label:d.toLocaleDateString('pt-BR',{month:'short',year:'numeric'}) })
  }
  return opts
}

export default function Dashboard() {
  const now = new Date()
  const cur = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const [selectedMonth, setSelectedMonth] = useState(cur)
  const [summary, setSummary] = useState<Summary>({total_expense:0,total_income:0,bills_pending:0,bills_overdue:0,bills_overdue_count:0})
  const [bills, setBills] = useState<Bill[]>([])
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [monthly, setMonthly] = useState<{month:string;despesas:number;receitas:number}[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showBillModal, setShowBillModal] = useState(false)
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])
  const [form, setForm] = useState({title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',transaction_date:new Date().toISOString().split('T')[0]})
  const [billForm, setBillForm] = useState({title:'',amount:'',due_date:'',category_id:'',recurrence:'once'})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const monthOpts = getMonthOptions()

  const load = useCallback(async () => {
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) { window.location.href='/'; return }
    const uid = user.id
    const mDate = new Date(selectedMonth)
    const mStart = `${mDate.getFullYear()}-${String(mDate.getMonth()+1).padStart(2,'0')}-01`
    const mEnd = new Date(mDate.getFullYear(), mDate.getMonth()+1, 0).toISOString().split('T')[0]
    const [{data:bl},{data:tx},{data:cats}] = await Promise.all([
      supabase.from('bills_live').select('*').eq('user_id',uid).gte('due_date',mStart).lte('due_date',mEnd).neq('status','cancelled').order('due_date'),
      supabase.from('transactions').select('*,categories(name)').eq('user_id',uid).eq('status','confirmed').gte('transaction_date',mStart).lte('transaction_date',mEnd).order('transaction_date',{ascending:false}),
      supabase.from('categories').select('id,name').or(`user_id.eq.${uid},user_id.is.null`).order('name'),
    ])
    const allTx = tx||[]
    const totalExp = allTx.filter((t:any)=>t.type==='expense').reduce((a:number,t:any)=>a+Number(t.amount),0)
    const totalInc = allTx.filter((t:any)=>t.type==='income').reduce((a:number,t:any)=>a+Number(t.amount),0)
    setSummary({total_expense:totalExp,total_income:totalInc,bills_pending:0,bills_overdue:0,bills_overdue_count:0})
    setBills(bl||[])
    setTransactions((tx||[]).slice(0,8))
    setCategories(cats||[])
    const months=[]
    for (let i=5;i>=0;i--) {
      const d=new Date(); d.setMonth(d.getMonth()-i)
      const mS=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
      const mE=new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().split('T')[0]
      const {data:mt}=await supabase.from('transactions').select('amount,type').eq('user_id',uid).eq('status','confirmed').gte('transaction_date',mS).lte('transaction_date',mE)
      const exp=(mt||[]).filter((t:any)=>t.type==='expense').reduce((a:number,t:any)=>a+t.amount,0)
      const inc=(mt||[]).filter((t:any)=>t.type==='income').reduce((a:number,t:any)=>a+t.amount,0)
      months.push({month:d.toLocaleDateString('pt-BR',{month:'short'}),despesas:exp,receitas:inc})
    }
    setMonthly(months)
    setLoading(false)
  },[selectedMonth])

  useEffect(()=>{load()},[load])

  async function saveTransaction() {
    if (!form.amount) return
    setSaving(true)
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').insert({user_id:user.id,title:form.title||'Lançamento',amount:parseFloat(form.amount.replace(',','.')),type:form.type,status:'confirmed',category_id:form.category_id||null,payment_method:form.payment_method,transaction_date:form.transaction_date,source:'manual'})
    setShowModal(false); setSaving(false); load()
  }

  async function saveBill() {
    setError('')
    if (!billForm.title.trim()) { setError('Informe o nome'); return }
    if (!billForm.amount) { setError('Informe o valor'); return }
    if (!billForm.due_date) { setError('Informe o vencimento'); return }
    const amt = parseFloat(billForm.amount.replace(',','.'))
    if (isNaN(amt)||amt<=0) { setError('Valor inválido'); return }
    setSaving(true)
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bills').insert({user_id:user.id,title:billForm.title.trim(),amount:amt,due_date:billForm.due_date,status:'pending',category_id:billForm.category_id||null,recurrence:billForm.recurrence,payment_method:'pix'})
    setShowBillModal(false); setBillForm({title:'',amount:'',due_date:'',category_id:'',recurrence:'once'}); setError(''); setSaving(false); load()
  }

  async function markPaid(id:string) {
    await supabase.from('bills').update({status:'paid'}).eq('id',id); load()
  }

  const totalContas = bills.filter(b=>b.status!=='paid').reduce((a,b)=>a+b.amount,0)
  const vencidas = bills.filter(b=>b.live_status==='overdue'&&b.status!=='paid')
  const hoje = bills.filter(b=>b.live_status==='due_today'&&b.status!=='paid')
  const proximas = bills.filter(b=>!['overdue','due_today'].includes(b.live_status)&&b.status!=='paid')
  const pagas = bills.filter(b=>b.status==='paid')
  const saldo = summary.total_income - summary.total_expense
  const isCurrentMonth = selectedMonth === cur

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:12}}>
      <div style={{width:28,height:28,border:'3px solid #E5E9F2',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{fontSize:12,color:'var(--muted)',fontWeight:500}}>Carregando...</span>
    </div>
  )

  return (
    <div style={{overflow:'hidden',width:'100%'}}>
      {/* TOPBAR */}
      <div style={{background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 14px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50,gap:8}}>
        <div style={{flexShrink:0}}>
          <div style={{fontSize:15,fontWeight:700}}>Dashboard</div>
          <div style={{fontSize:10,color:'var(--muted)',fontWeight:500,whiteSpace:'nowrap'}}>{new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',minWidth:0}}>
          <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={{width:'auto',minWidth:0,padding:'5px 7px',fontSize:11,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC',cursor:'pointer',flexShrink:1}}>
            {monthOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={()=>setShowBillModal(true)} style={{padding:'6px 10px',background:'#F1F5F9',color:'#334155',border:'1.5px solid var(--border)',borderRadius:8,fontSize:11,fontWeight:600,whiteSpace:'nowrap',flexShrink:0}}>+ Conta</button>
          <button onClick={()=>setShowModal(true)} style={{padding:'6px 10px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:11,fontWeight:600,whiteSpace:'nowrap',flexShrink:0}}>+ Lançar</button>
        </div>
      </div>

      <div style={{padding:'14px',width:'100%',overflow:'hidden'}}>
        {!isCurrentMonth&&<div style={{marginBottom:12,padding:'7px 12px',background:'#FFF7ED',border:'1px solid #FED7AA',borderRadius:8,fontSize:11,fontWeight:600,color:'#C2410C'}}>⚠ Visualizando: {monthOpts.find(o=>o.value===selectedMonth)?.label}</div>}

        {/* KPI CARDS - 2x2 no mobile, sem cortar */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          {[
            {label:'A Pagar',value:formatBRL(totalContas),sub:`${bills.filter(b=>b.status!=='paid').length} contas`,color:'var(--danger)',bg:'var(--danger-light)'},
            {label:'Despesas',value:formatBRL(summary.total_expense),sub:'Pagas no mês',color:'#1E40AF',bg:'#EFF6FF'},
            {label:'Receitas',value:formatBRL(summary.total_income),sub:'Total do mês',color:'var(--success)',bg:'var(--success-light)'},
            {label:'Saldo Líquido',value:formatBRL(saldo),sub:saldo>=0?'Positivo':'Negativo',color:saldo>=0?'var(--success)':'var(--danger)',bg:saldo>=0?'var(--success-light)':'var(--danger-light)'},
          ].map((c,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:'12px',borderLeft:`3px solid ${c.color}`,minWidth:0,overflow:'hidden'}}>
              <div style={{fontSize:10,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.label}</div>
              <div style={{fontSize:15,fontWeight:800,color:c.color,fontFamily:'JetBrains Mono,monospace',letterSpacing:'-0.5px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.value}</div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:2,fontWeight:500}}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* CONTAS DO MÊS */}
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,marginBottom:14,overflow:'hidden'}}>
          <div style={{padding:'12px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#FAFAFA'}}>
            <div>
              <div style={{fontSize:13,fontWeight:700}}>Contas do Mês</div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{bills.length} contas · {formatBRL(totalContas)} pendente</div>
            </div>
            <a href="/bills" style={{fontSize:11,fontWeight:600,color:'var(--accent)'}}>Ver todas →</a>
          </div>
          {bills.length===0?(
            <div style={{padding:'28px',textAlign:'center',color:'var(--muted)'}}>
              <div style={{fontSize:28,marginBottom:8}}>🎉</div>
              <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Sem contas neste mês</div>
              <button onClick={()=>setShowBillModal(true)} style={{padding:'6px 16px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>+ Adicionar</button>
            </div>
          ):(
            <>
              {vencidas.length>0&&<BillSection title="⚠ Vencidas" color="var(--danger)" bg="#FFF1F1" bills={vencidas} onPay={markPaid}/>}
              {hoje.length>0&&<BillSection title="🔔 Vence hoje" color="var(--warning)" bg="#FFFBEB" bills={hoje} onPay={markPaid}/>}
              {proximas.length>0&&<BillSection title="📋 Próximas" color="#475569" bg="#F8FAFC" bills={proximas} onPay={markPaid}/>}
              {pagas.length>0&&<BillSection title="✅ Pagas" color="var(--success)" bg="#F0FDF4" bills={pagas} onPay={markPaid} paid/>}
            </>
          )}
        </div>

        {/* GRÁFICO */}
        {monthly.some(m=>m.despesas>0||m.receitas>0)&&(
          <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'14px',marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Evolução 6 Meses</div>
            <div style={{fontSize:10,color:'var(--muted)',marginBottom:12}}>Receitas vs Despesas</div>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={monthly}>
                <XAxis dataKey="month" tick={{fontSize:9,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip formatter={(v:number)=>formatBRL(v)} contentStyle={{fontSize:11,borderRadius:8,border:'1px solid var(--border)'}}/>
                <Area type="monotone" dataKey="receitas" stroke="var(--success)" fill="#DCFCE7" strokeWidth={2} name="Receitas"/>
                <Area type="monotone" dataKey="despesas" stroke="var(--danger)" fill="#FEE2E2" strokeWidth={2} name="Despesas"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ÚLTIMOS LANÇAMENTOS */}
        {transactions.length>0&&(
          <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'12px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#FAFAFA'}}>
              <div style={{fontSize:13,fontWeight:700}}>Lançamentos do Mês</div>
              <a href="/transactions" style={{fontSize:11,fontWeight:600,color:'var(--accent)'}}>Ver todos →</a>
            </div>
            {transactions.map(t=>(
              <div key={t.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid #F8FAFC',gap:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
                  <div style={{width:30,height:30,borderRadius:8,background:t.type==='income'?'var(--success-light)':'var(--danger-light)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0,fontWeight:700,color:t.type==='income'?'var(--success)':'var(--danger)'}}>{t.type==='income'?'↑':'↓'}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                    <div style={{fontSize:10,color:'var(--muted)',fontWeight:500}}>{formatDate(t.transaction_date)} · {(t.categories as {name:string}|null)?.name||'—'}</div>
                  </div>
                </div>
                <span style={{fontSize:12,fontWeight:700,fontFamily:'JetBrains Mono,monospace',color:t.type==='income'?'var(--success)':'var(--danger)',flexShrink:0,letterSpacing:'-0.3px'}}>{t.type==='income'?'+':'-'}{formatBRL(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL LANÇAMENTO */}
      {showModal&&<Modal title="Novo Lançamento" onClose={()=>setShowModal(false)}>
        <div style={{display:'flex',gap:4,background:'#F1F5F9',padding:4,borderRadius:8,marginBottom:14}}>
          {[{v:'expense',l:'💳 Despesa'},{v:'income',l:'💰 Receita'}].map(tp=>(
            <button key={tp.v} onClick={()=>setForm(f=>({...f,type:tp.v}))} style={{flex:1,padding:'7px',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600,background:form.type===tp.v?'#fff':'transparent',color:form.type===tp.v?'var(--text)':'var(--muted)'}}>{tp.l}</button>
          ))}
        </div>
        <FG label="Descrição"><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Mercado, Gasolina..."/></FG>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <FG label="Valor"><input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></FG>
          <FG label="Data"><input type="date" value={form.transaction_date} onChange={e=>setForm(f=>({...f,transaction_date:e.target.value}))}/></FG>
        </div>
        <FG label="Categoria"><select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}><option value="">Selecionar...</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></FG>
        <FG label="Pagamento"><select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}><option value="pix">PIX</option><option value="debit">Débito</option><option value="credit">Crédito</option><option value="cash">Dinheiro</option></select></FG>
        <BtnRow onCancel={()=>setShowModal(false)} onSave={saveTransaction} saving={saving} label="Salvar Lançamento"/>
      </Modal>}

      {/* MODAL CONTA */}
      {showBillModal&&<Modal title="Nova Conta a Pagar" onClose={()=>{setShowBillModal(false);setError('')}}>
        {error&&<div style={{marginBottom:12,padding:'9px 12px',background:'var(--danger-light)',border:'1px solid #FECACA',borderRadius:8,fontSize:12,fontWeight:600,color:'var(--danger)'}}>⚠ {error}</div>}
        <FG label="Nome da Conta *"><input value={billForm.title} onChange={e=>setBillForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Aluguel, Energia..." autoFocus/></FG>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <FG label="Valor *"><input value={billForm.amount} onChange={e=>setBillForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></FG>
          <FG label="Vencimento *"><input type="date" value={billForm.due_date} onChange={e=>setBillForm(f=>({...f,due_date:e.target.value}))}/></FG>
        </div>
        <FG label="Categoria"><select value={billForm.category_id} onChange={e=>setBillForm(f=>({...f,category_id:e.target.value}))}><option value="">Selecionar...</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></FG>
        <FG label="Recorrência"><select value={billForm.recurrence} onChange={e=>setBillForm(f=>({...f,recurrence:e.target.value}))}><option value="once">Única vez</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></FG>
        <BtnRow onCancel={()=>{setShowBillModal(false);setError('')}} onSave={saveBill} saving={saving} label="Adicionar Conta"/>
      </Modal>}
    </div>
  )
}

function BillSection({title,color,bg,bills,onPay,paid}:{title:string,color:string,bg:string,bills:any[],onPay:(id:string)=>void,paid?:boolean}) {
  return (
    <div>
      <div style={{padding:'6px 14px',background:bg,fontSize:10,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.5px',borderBottom:'1px solid var(--border)'}}>{title}</div>
      {bills.map(b=>(
        <div key={b.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid #F8FAFC',gap:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:paid?'var(--muted)':'var(--text)',textDecoration:paid?'line-through':'none'}}>{b.title}</div>
            <div style={{fontSize:10,color:'var(--muted)',marginTop:1,fontWeight:500}}>{b.category_name||'—'} · {formatDate(b.due_date)}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
            <span style={{fontSize:12,fontWeight:700,fontFamily:'JetBrains Mono,monospace',color:paid?'var(--success)':b.live_status==='overdue'?'var(--danger)':'var(--text)',letterSpacing:'-0.3px'}}>{formatBRL(b.amount)}</span>
            {!paid&&<button onClick={()=>onPay(b.id)} style={{padding:'3px 9px',background:'var(--success-light)',color:'var(--success)',border:'1px solid #BBF7D0',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:700}}>Pagar</button>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Modal({title,children,onClose}:{title:string,children:React.ReactNode,onClose:()=>void}) {
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:'fixed',inset:0,background:'rgba(15,23,42,.5)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div style={{background:'#fff',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:520,maxHeight:'92vh',overflowY:'auto',padding:'18px 16px 32px'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700}}>{title}</div>
          <button onClick={onClose} style={{background:'#F1F5F9',border:'none',borderRadius:8,width:28,height:28,cursor:'pointer',fontSize:14,color:'var(--muted)'}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FG({label,children}:{label:string,children:React.ReactNode}) {
  return (
    <div style={{marginBottom:12}}>
      <label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</label>
      {children}
    </div>
  )
}

function BtnRow({onCancel,onSave,saving,label}:{onCancel:()=>void,onSave:()=>void,saving:boolean,label:string}) {
  return (
    <div style={{display:'flex',gap:8,marginTop:8}}>
      <button onClick={onCancel} style={{flex:1,padding:11,border:'1.5px solid var(--border)',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--muted)'}}>Cancelar</button>
      <button onClick={onSave} disabled={saving} style={{flex:2,padding:11,background:saving?'#93C5FD':'var(--accent)',color:'#fff',border:'none',borderRadius:8,cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:700,opacity:saving?.8:1}}>{saving?'Salvando...':label}</button>
    </div>
  )
}
