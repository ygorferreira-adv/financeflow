'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate } from '@/lib/utils'

interface Bill { id:string;title:string;amount:number;due_date:string;status:string;live_status:string;category_name:string;recurrence:string;days_until_due:number }

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])
  const [form, setForm] = useState({ title:'',amount:'',due_date:'',category_id:'',recurrence:'once',notes:'' })
  const [saving, setSaving] = useState(false)
  const [totalPending, setTotalPending] = useState(0)

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    let q = supabase.from('bills_live').select('*').eq('user_id',user.id).order('due_date')
    if (filter !== 'all') {
      if (filter === 'overdue') q = q.eq('live_status','overdue')
      else if (filter === 'pending') q = q.in('status',['pending']).gte('due_date',new Date().toISOString().split('T')[0])
      else if (filter === 'paid') q = q.eq('status','paid')
    }
    const { data } = await q
    setBills(data||[])
    const { data: all } = await supabase.from('bills_live').select('amount,status').eq('user_id',user.id).neq('status','paid')
    setTotalPending((all||[]).reduce((a,b)=>a+b.amount,0))
    const { data:cats } = await supabase.from('categories').select('id,name').or(`user_id.eq.${user.id},user_id.is.null`).order('name')
    setCategories(cats||[])
  }, [filter])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.title || !form.amount || !form.due_date) return
    setSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('bills').insert({
      user_id:user.id, title:form.title,
      amount:parseFloat(form.amount.replace(',','.')),
      due_date:form.due_date, category_id:form.category_id||null,
      recurrence:form.recurrence, notes:form.notes||null, status:'pending', payment_method:'pix'
    })
    setShowModal(false)
    setForm({ title:'',amount:'',due_date:'',category_id:'',recurrence:'once',notes:'' })
    setSaving(false); load()
  }

  async function markPaid(id:string) {
    await supabase.from('bills').update({ status:'paid' }).eq('id',id); load()
  }

  const recLabel = (r:string) => r==='monthly'?'Mensal':r==='yearly'?'Anual':r==='weekly'?'Semanal':'Única'
  const tabs = [{ v:'all',l:'Todas' },{ v:'overdue',l:'Vencidas' },{ v:'pending',l:'Pendentes' },{ v:'paid',l:'Pagas' }]

  const overdue = bills.filter(b=>b.live_status==='overdue')
  const others = bills.filter(b=>b.live_status!=='overdue')

  return (
    <div>
      <div style={{ background:'#fff',borderBottom:'1px solid #E5E9F2',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50 }}>
        <div>
          <div style={{ fontSize:15,fontWeight:700 }}>Contas a Pagar</div>
          <div style={{ fontSize:11,color:'#9AA3B2' }}>Total pendente: {formatBRL(totalPending)}</div>
        </div>
        <button onClick={()=>setShowModal(true)} style={{ padding:'6px 14px',background:'#2563EB',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans,sans-serif' }}>+ Nova</button>
      </div>

      <div style={{ padding:'16px' }}>
        {/* Tabs */}
        <div style={{ display:'flex',gap:6,marginBottom:16,overflowX:'auto',paddingBottom:4 }}>
          {tabs.map(t=>(
            <button key={t.v} onClick={()=>setFilter(t.v)} style={{ padding:'6px 14px',border:'none',borderRadius:20,cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:600,whiteSpace:'nowrap',background:filter===t.v?'#2563EB':'#fff',color:filter===t.v?'#fff':'#5A6478',boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>{t.l}</button>
          ))}
        </div>

        {/* Vencidas em destaque */}
        {overdue.length > 0 && filter==='all' && (
          <div style={{ background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:12,marginBottom:12,overflow:'hidden' }}>
            <div style={{ padding:'10px 14px',borderBottom:'1px solid #FECACA',fontSize:12,fontWeight:700,color:'#DC2626' }}>⚠️ {overdue.length} conta{overdue.length>1?'s':''} vencida{overdue.length>1?'s':''} — Pague agora!</div>
            {overdue.map(b=><BillCard key={b.id} b={b} onPay={markPaid} recLabel={recLabel}/>)}
          </div>
        )}

        {/* Lista */}
        {(filter==='all'?others:bills).length === 0 && overdue.length===0 ? (
          <div style={{ textAlign:'center',padding:'48px 20px',color:'#9AA3B2' }}>
            <div style={{ fontSize:40,marginBottom:12 }}>🎉</div>
            <div style={{ fontSize:14,fontWeight:600 }}>{filter==='paid'?'Nenhuma conta paga':'Nenhuma conta aqui'}</div>
            <button onClick={()=>setShowModal(true)} style={{ marginTop:14,padding:'8px 20px',background:'#2563EB',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans,sans-serif' }}>+ Adicionar conta</button>
          </div>
        ) : (
          <div style={{ background:'#fff',border:'1px solid #E5E9F2',borderRadius:12,overflow:'hidden' }}>
            {(filter==='all'?others:bills).map(b=><BillCard key={b.id} b={b} onPay={markPaid} recLabel={recLabel}/>)}
          </div>
        )}
      </div>

      {showModal && (
        <div onClick={e=>{ if(e.target===e.currentTarget) setShowModal(false) }} style={{ position:'fixed',inset:0,background:'rgba(13,17,23,0.5)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center' }}>
          <div style={{ background:'#fff',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:600,padding:'20px 16px 32px',maxHeight:'90vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <div style={{ fontSize:16,fontWeight:700 }}>Nova Conta a Pagar</div>
              <button onClick={()=>setShowModal(false)} style={{ background:'#F0F2F7',border:'none',borderRadius:8,width:30,height:30,cursor:'pointer',fontSize:16 }}>✕</button>
            </div>
            {[{ label:'Nome da Conta', key:'title', ph:'Ex: Aluguel, Energia...' },].map(f=>(
              <div key={f.key} style={{ marginBottom:12 }}>
                <label style={{ display:'block',fontSize:11,fontWeight:600,color:'#5A6478',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.4px' }}>{f.label}</label>
                <input value={form[f.key as keyof typeof form]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}/>
              </div>
            ))}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
              <div><label style={{ display:'block',fontSize:11,fontWeight:600,color:'#5A6478',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.4px' }}>Valor</label><input value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:600,color:'#5A6478',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.4px' }}>Vencimento</label><input type="date" value={form.due_date} onChange={e=>setForm(p=>({...p,due_date:e.target.value}))}/></div>
            </div>
            <div style={{ marginBottom:12 }}><label style={{ display:'block',fontSize:11,fontWeight:600,color:'#5A6478',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.4px' }}>Categoria</label>
              <select value={form.category_id} onChange={e=>setForm(p=>({...p,category_id:e.target.value}))}>
                <option value="">Selecionar...</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:16 }}><label style={{ display:'block',fontSize:11,fontWeight:600,color:'#5A6478',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.4px' }}>Recorrência</label>
              <select value={form.recurrence} onChange={e=>setForm(p=>({...p,recurrence:e.target.value}))}>
                <option value="once">Única</option><option value="monthly">Mensal</option><option value="yearly">Anual</option><option value="weekly">Semanal</option>
              </select>
            </div>
            <div style={{ display:'flex',gap:8 }}>
              <button onClick={()=>setShowModal(false)} style={{ flex:1,padding:12,border:'1px solid #CDD3E0',borderRadius:8,background:'#fff',cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:600,color:'#5A6478' }}>Cancelar</button>
              <button onClick={save} disabled={saving} style={{ flex:2,padding:12,background:'#2563EB',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:600,opacity:saving?0.7:1 }}>{saving?'Salvando...':'Salvar Conta'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BillCard({ b, onPay, recLabel }:{ b:Bill, onPay:(id:string)=>void, recLabel:(r:string)=>string }) {
  const isOverdue = b.live_status==='overdue'
  const isToday = b.live_status==='due_today'
  const isPaid = b.status==='paid'
  return (
    <div style={{ padding:'13px 16px',borderBottom:'1px solid #F0F2F7',display:'flex',alignItems:'center',gap:12 }}>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:14,fontWeight:600,color:isOverdue?'#DC2626':'#0D1117',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{b.title}</div>
        <div style={{ fontSize:11,color:'#9AA3B2',marginTop:2,display:'flex',gap:8,flexWrap:'wrap' }}>
          <span>📅 {formatDate(b.due_date)}</span>
          {b.category_name && <span>🏷️ {b.category_name}</span>}
          <span>🔄 {recLabel(b.recurrence)}</span>
        </div>
        {(isOverdue||isToday) && !isPaid && (
          <span style={{ display:'inline-block',marginTop:4,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:isOverdue?'#FEF2F2':'#FFFBEB',color:isOverdue?'#DC2626':'#D97706' }}>
            {isOverdue?'⚠️ VENCIDA':'📅 VENCE HOJE'}
          </span>
        )}
      </div>
      <div style={{ textAlign:'right',flexShrink:0 }}>
        <div style={{ fontSize:15,fontWeight:700,fontFamily:'DM Mono,monospace',color:isOverdue?'#DC2626':isPaid?'#16A34A':'#0D1117',marginBottom:6 }}>{formatBRL(b.amount)}</div>
        {!isPaid ? (
          <button onClick={()=>onPay(b.id)} style={{ padding:'5px 12px',background:'#DCFCE7',color:'#16A34A',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'DM Sans,sans-serif' }}>Pagar ✓</button>
        ) : (
          <span style={{ fontSize:11,fontWeight:700,color:'#16A34A' }}>✅ Paga</span>
        )}
      </div>
    </div>
  )
}
