'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate, monthStart, monthEnd, monthLabel } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Gera opções de mês: 6 meses atrás até 3 meses à frente
function monthOpts() {
  const opts=[]
  for(let i=-5;i<=3;i++){
    const s=monthStart(i)
    opts.push({value:s,label:monthLabel(s)})
  }
  return opts
}

export default function Dashboard() {
  const [month, setMonth] = useState(monthStart(0))
  const [loading, setLoading] = useState(true)
  const [txs, setTxs] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [chart, setChart] = useState<any[]>([])
  const [cats, setCats] = useState<any[]>([])
  const [showTxModal, setShowTxModal] = useState(false)
  const [showBillModal, setShowBillModal] = useState(false)
  const [form, setForm] = useState({title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',date:new Date().toISOString().split('T')[0]})
  const [bform, setBform] = useState({title:'',amount:'',due_date:'',category_id:'',recurrence:'once'})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const opts = monthOpts()

  const load = useCallback(async () => {
    setLoading(true)
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) { window.location.href='/'; return }
    const uid = user.id
    const mS = month
    const mE = monthEnd(month)

    // Buscar transactions E bills do mês selecionado em paralelo
    const [r1, r2, r3] = await Promise.all([
      supabase.from('transactions').select('*,categories(name)')
        .eq('user_id',uid).gte('transaction_date',mS).lte('transaction_date',mE)
        .order('transaction_date',{ascending:false}),
      supabase.from('bills_live').select('*')
        .eq('user_id',uid).gte('due_date',mS).lte('due_date',mE)
        .neq('status','cancelled').order('due_date'),
      supabase.from('categories').select('id,name')
        .or(`user_id.eq.${uid},user_id.is.null`).order('name'),
    ])
    setTxs(r1.data||[])
    setBills(r2.data||[])
    setCats(r3.data||[])

    // Gráfico: 6 meses anteriores + mês atual (sempre fixo, não muda com seletor)
    const chartData = []
    for(let i=5;i>=0;i--) {
      const s=monthStart(-i), e=monthEnd(s)
      const {data:mt} = await supabase.from('transactions')
        .select('amount,type').eq('user_id',uid).eq('status','confirmed')
        .gte('transaction_date',s).lte('transaction_date',e)
      const exp=(mt||[]).filter((t:any)=>t.type==='expense').reduce((a:any,t:any)=>a+Number(t.amount),0)
      const inc=(mt||[]).filter((t:any)=>t.type==='income').reduce((a:any,t:any)=>a+Number(t.amount),0)
      chartData.push({label:new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{month:'short'}),despesas:exp,receitas:inc})
    }
    setChart(chartData)
    setLoading(false)
  }, [month])

  useEffect(()=>{ load() },[load])

  // KPIs calculados direto dos dados — sem view, sem RPC
  const confirmedTxs = txs.filter((t:any)=>t.status==='confirmed')
  const totalExp = confirmedTxs.filter((t:any)=>t.type==='expense').reduce((a:any,t:any)=>a+Number(t.amount),0)
  const totalInc = confirmedTxs.filter((t:any)=>t.type==='income').reduce((a:any,t:any)=>a+Number(t.amount),0)
  const billsPending = bills.filter((b:any)=>b.status!=='paid').reduce((a:any,b:any)=>a+Number(b.amount),0)
  const billsOverdue = bills.filter((b:any)=>b.live_status==='overdue'&&b.status!=='paid')
  const saldo = totalInc - totalExp

  const vencidas = bills.filter((b:any)=>b.live_status==='overdue'&&b.status!=='paid')
  const hoje = bills.filter((b:any)=>b.live_status==='due_today'&&b.status!=='paid')
  const proximas = bills.filter((b:any)=>!['overdue','due_today'].includes(b.live_status)&&b.status!=='paid')
  const pagas = bills.filter((b:any)=>b.status==='paid')

  async function saveTx() {
    setErr('')
    if (!form.amount) { setErr('Informe o valor'); return }
    const amt = parseFloat(form.amount.replace(',','.'))
    if (isNaN(amt)||amt<=0) { setErr('Valor inválido'); return }
    setSaving(true)
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').insert({
      user_id:user.id, title:form.title||'Lançamento', amount:amt,
      type:form.type, status:'confirmed', category_id:form.category_id||null,
      payment_method:form.payment_method, transaction_date:form.date, source:'manual'
    })
    setShowTxModal(false); setSaving(false); load()
  }

  async function saveBill() {
    setErr('')
    if (!bform.title.trim()) { setErr('Informe o nome'); return }
    if (!bform.amount) { setErr('Informe o valor'); return }
    if (!bform.due_date) { setErr('Informe o vencimento'); return }
    const amt = parseFloat(bform.amount.replace(',','.'))
    if (isNaN(amt)||amt<=0) { setErr('Valor inválido'); return }
    setSaving(true)
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bills').insert({
      user_id:user.id, title:bform.title.trim(), amount:amt,
      due_date:bform.due_date, status:'pending', category_id:bform.category_id||null,
      recurrence:bform.recurrence, payment_method:'pix'
    })
    setShowBillModal(false); setSaving(false); load()
  }

  async function payBill(id:string) {
    await supabase.from('bills').update({status:'paid'}).eq('id',id); load()
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'80vh',flexDirection:'column',gap:12}}>
      <div style={{width:28,height:28,border:'3px solid #E4E8F0',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{fontSize:12,color:'var(--muted)'}}>Carregando...</span>
    </div>
  )

  return (
    <div>
      {/* TOPBAR */}
      <div style={{background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50,gap:8}}>
        <div style={{flexShrink:0}}>
          <div style={{fontSize:15,fontWeight:700}}>Dashboard</div>
          <div style={{fontSize:10,color:'var(--muted)'}}>{monthLabel(month)}</div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',minWidth:0,flex:1,justifyContent:'flex-end'}}>
          <select value={month} onChange={e=>setMonth(e.target.value)} style={{width:'auto',maxWidth:140,padding:'5px 8px',fontSize:11,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC',flexShrink:1}}>
            {opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={()=>{setErr('');setShowBillModal(true)}} style={{padding:'6px 10px',background:'#F1F5F9',color:'#334155',border:'1.5px solid var(--border)',borderRadius:8,fontSize:11,fontWeight:600,flexShrink:0}}>+ Conta</button>
          <button onClick={()=>{setErr('');setShowTxModal(true)}} style={{padding:'6px 10px',background:'var(--accent)',color:'#fff',borderRadius:8,fontSize:11,fontWeight:600,flexShrink:0}}>+ Lançar</button>
        </div>
      </div>

      <div style={{padding:'14px 16px'}}>
        {/* KPIS */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          {[
            {l:'Despesas do Mês',v:formatBRL(totalExp),s:`${confirmedTxs.filter((t:any)=>t.type==='expense').length} lançamentos`,c:'var(--danger)',bg:'var(--danger-l)'},
            {l:'Receitas do Mês',v:formatBRL(totalInc),s:`${confirmedTxs.filter((t:any)=>t.type==='income').length} entradas`,c:'var(--success)',bg:'var(--success-l)'},
            {l:'Contas a Pagar',v:formatBRL(billsPending),s:`${bills.filter((b:any)=>b.status!=='paid').length} pendentes`,c:'var(--warn)',bg:'var(--warn-l)'},
            {l:'Saldo Líquido',v:formatBRL(saldo),s:saldo>=0?'Positivo':'Negativo',c:saldo>=0?'var(--success)':'var(--danger)',bg:saldo>=0?'var(--success-l)':'var(--danger-l)'},
          ].map((k,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:'12px',borderLeft:`3px solid ${k.c}`,minWidth:0}}>
              <div style={{fontSize:9,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:4}}>{k.l}</div>
              <div style={{fontSize:16,fontWeight:800,color:k.c,fontFamily:'JetBrains Mono,monospace',letterSpacing:'-0.5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{k.v}</div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{k.s}</div>
            </div>
          ))}
        </div>

        {/* BILLS DO MÊS */}
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,marginBottom:14,overflow:'hidden'}}>
          <div style={{padding:'11px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#FAFAFA'}}>
            <div>
              <div style={{fontSize:13,fontWeight:700}}>Contas do Mês</div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{bills.length} contas · {formatBRL(billsPending)} pendente</div>
            </div>
            <a href="/bills" style={{fontSize:11,fontWeight:600,color:'var(--accent)'}}>Ver todas →</a>
          </div>
          {bills.length===0?(
            <div style={{padding:'28px',textAlign:'center',color:'var(--muted)'}}>
              <div style={{fontSize:28,marginBottom:8}}>✅</div>
              <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>Sem contas neste mês</div>
              <div style={{fontSize:11,color:'var(--muted)',marginBottom:12}}>Selecione outro mês ou adicione uma conta</div>
              <button onClick={()=>{setErr('');setShowBillModal(true)}} style={{padding:'7px 18px',background:'var(--accent)',color:'#fff',borderRadius:8,fontSize:12,fontWeight:600}}>+ Adicionar conta</button>
            </div>
          ):(
            <>
              {vencidas.length>0&&<BillGroup title="⚠ Vencidas" color="var(--danger)" bg="#FFF1F1" items={vencidas} onPay={payBill}/>}
              {hoje.length>0&&<BillGroup title="🔔 Vence Hoje" color="var(--warn)" bg="var(--warn-l)" items={hoje} onPay={payBill}/>}
              {proximas.length>0&&<BillGroup title="📋 Próximas" color="#475569" bg="#F8FAFC" items={proximas} onPay={payBill}/>}
              {pagas.length>0&&<BillGroup title="✅ Pagas" color="var(--success)" bg="var(--success-l)" items={pagas} onPay={payBill} paid/>}
            </>
          )}
        </div>

        {/* LANÇAMENTOS */}
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,marginBottom:14,overflow:'hidden'}}>
          <div style={{padding:'11px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#FAFAFA'}}>
            <div style={{fontSize:13,fontWeight:700}}>Lançamentos do Mês</div>
            <a href="/transactions" style={{fontSize:11,fontWeight:600,color:'var(--accent)'}}>Ver todos →</a>
          </div>
          {txs.length===0?(
            <div style={{padding:'24px',textAlign:'center',color:'var(--muted)',fontSize:12}}>Nenhum lançamento neste mês</div>
          ):txs.slice(0,8).map((t:any,i:number)=>(
            <div key={t.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:i<Math.min(txs.length,8)-1?'1px solid #F8FAFC':'none',gap:8}}>
              <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
                <div style={{width:30,height:30,borderRadius:8,background:t.type==='income'?'var(--success-l)':'var(--danger-l)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0,color:t.type==='income'?'var(--success)':'var(--danger)',fontWeight:700}}>{t.type==='income'?'↑':'↓'}</div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {t.title}
                    {t.source==='whatsapp'&&<span style={{fontSize:9,background:'#ECFDF5',color:'#065F46',padding:'1px 5px',borderRadius:6,fontWeight:700,marginLeft:5}}>BOT</span>}
                  </div>
                  <div style={{fontSize:10,color:'var(--muted)'}}>{formatDate(t.transaction_date)} · {t.categories?.name||'—'}</div>
                </div>
              </div>
              <span style={{fontSize:13,fontWeight:700,fontFamily:'JetBrains Mono,monospace',color:t.type==='income'?'var(--success)':'var(--danger)',flexShrink:0}}>
                {t.type==='income'?'+':'-'}{formatBRL(Number(t.amount))}
              </span>
            </div>
          ))}
        </div>

        {/* GRÁFICO */}
        {chart.some((m:any)=>m.despesas>0||m.receitas>0)&&(
          <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'14px'}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Evolução 6 Meses</div>
            <div style={{fontSize:10,color:'var(--muted)',marginBottom:12}}>Despesas e receitas</div>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={chart}>
                <XAxis dataKey="label" tick={{fontSize:9,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip formatter={(v:number)=>formatBRL(v)} contentStyle={{fontSize:11,borderRadius:8}}/>
                <Area type="monotone" dataKey="receitas" stroke="var(--success)" fill="#DCFCE7" strokeWidth={2} name="Receitas"/>
                <Area type="monotone" dataKey="despesas" stroke="var(--danger)" fill="#FEE2E2" strokeWidth={2} name="Despesas"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* MODAL LANÇAMENTO */}
      {showTxModal&&<Modal title="Novo Lançamento" onClose={()=>setShowTxModal(false)} err={err}>
        <div style={{display:'flex',gap:4,background:'#F1F5F9',padding:4,borderRadius:8,marginBottom:14}}>
          {[{v:'expense',l:'💳 Despesa'},{v:'income',l:'💰 Receita'}].map(tp=>(
            <button key={tp.v} onClick={()=>setForm(f=>({...f,type:tp.v}))} style={{flex:1,padding:'7px',borderRadius:6,fontSize:12,fontWeight:600,background:form.type===tp.v?'#fff':'transparent',color:form.type===tp.v?'var(--text)':'var(--muted)'}}>{tp.l}</button>
          ))}
        </div>
        <FG l="Descrição"><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Mercado, Gasolina..."/></FG>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <FG l="Valor *"><input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></FG>
          <FG l="Data"><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></FG>
        </div>
        <FG l="Categoria"><select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}><option value="">Selecionar...</option>{cats.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></FG>
        <FG l="Pagamento"><select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}><option value="pix">PIX</option><option value="debit">Débito</option><option value="credit">Crédito</option><option value="cash">Dinheiro</option></select></FG>
        <Btns onCancel={()=>setShowTxModal(false)} onSave={saveTx} saving={saving} label="Salvar Lançamento"/>
      </Modal>}

      {/* MODAL CONTA */}
      {showBillModal&&<Modal title="Nova Conta a Pagar" onClose={()=>setShowBillModal(false)} err={err}>
        <FG l="Nome da Conta *"><input value={bform.title} onChange={e=>setBform(f=>({...f,title:e.target.value}))} placeholder="Ex: Aluguel, Energia..." autoFocus/></FG>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <FG l="Valor *"><input value={bform.amount} onChange={e=>setBform(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></FG>
          <FG l="Vencimento *"><input type="date" value={bform.due_date} onChange={e=>setBform(f=>({...f,due_date:e.target.value}))}/></FG>
        </div>
        <FG l="Categoria"><select value={bform.category_id} onChange={e=>setBform(f=>({...f,category_id:e.target.value}))}><option value="">Selecionar...</option>{cats.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></FG>
        <FG l="Recorrência"><select value={bform.recurrence} onChange={e=>setBform(f=>({...f,recurrence:e.target.value}))}><option value="once">Única vez</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></FG>
        <Btns onCancel={()=>setShowBillModal(false)} onSave={saveBill} saving={saving} label="Adicionar Conta"/>
      </Modal>}
    </div>
  )
}

function BillGroup({title,color,bg,items,onPay,paid}:any) {
  return(<div>
    <div style={{padding:'6px 14px',background:bg,fontSize:10,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.5px',borderBottom:'1px solid var(--border)'}}>{title}</div>
    {items.map((b:any)=>(
      <div key={b.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid #F8FAFC',gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:paid?'var(--muted)':'var(--text)',textDecoration:paid?'line-through':'none'}}>{b.title}</div>
          <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{b.category_name||'—'} · {formatDate(b.due_date)}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          <span style={{fontSize:12,fontWeight:700,fontFamily:'JetBrains Mono,monospace',color:paid?'var(--success)':b.live_status==='overdue'?'var(--danger)':'var(--text)'}}>{formatBRL(Number(b.amount))}</span>
          {!paid&&<button onClick={()=>onPay(b.id)} style={{padding:'3px 8px',background:'var(--success-l)',color:'var(--success)',border:'1px solid #BBF7D0',borderRadius:6,fontSize:10,fontWeight:700}}>Pagar</button>}
        </div>
      </div>
    ))}
  </div>)
}

function Modal({title,children,onClose,err}:any) {
  return(<div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:'fixed',inset:0,background:'rgba(15,23,42,.5)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
    <div style={{background:'#fff',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:520,padding:'18px 16px 32px',maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:15,fontWeight:700}}>{title}</div>
        <button onClick={onClose} style={{background:'#F1F5F9',borderRadius:8,width:28,height:28,fontSize:14,color:'var(--muted)'}}>✕</button>
      </div>
      {err&&<div style={{marginBottom:12,padding:'9px 12px',background:'var(--danger-l)',border:'1px solid #FECACA',borderRadius:8,fontSize:12,fontWeight:600,color:'var(--danger)'}}>⚠ {err}</div>}
      {children}
    </div>
  </div>)
}

function FG({l,children}:any){return(<div style={{marginBottom:12}}>
  <label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>{l}</label>
  {children}
</div>)}

function Btns({onCancel,onSave,saving,label}:any){return(<div style={{display:'flex',gap:8,marginTop:6}}>
  <button onClick={onCancel} style={{flex:1,padding:11,border:'1.5px solid var(--border)',borderRadius:8,background:'#fff',fontSize:13,fontWeight:600,color:'var(--muted)'}}>Cancelar</button>
  <button onClick={onSave} disabled={saving} style={{flex:2,padding:11,background:saving?'#93C5FD':'var(--accent)',color:'#fff',borderRadius:8,fontSize:13,fontWeight:700}}>{saving?'Salvando...':label}</button>
</div>)}
