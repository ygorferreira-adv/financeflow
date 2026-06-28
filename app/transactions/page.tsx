'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate } from '@/lib/utils'

interface Tx { id:string;title:string;amount:number;type:string;transaction_date:string;payment_method:string;status:string;source:string;category_id:string;categories?:{name:string}|null }

const STATUS_OPTS = [
  { v:'confirmed', l:'Confirmado', color:'#16A34A', bg:'#F0FDF4' },
  { v:'pending', l:'Pendente', color:'#D97706', bg:'#FFFBEB' },
  { v:'cancelled', l:'Cancelado', color:'#6B7280', bg:'#F9FAFB' },
]

function getMonthOptions() {
  const opts:{value:string;label:string}[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
    opts.push({ value:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, label:d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) })
  }
  return opts
}

export default function TransactionsPage() {
  const now = new Date()
  const cur = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const [selectedMonth, setSelectedMonth] = useState(cur)
  const [txs, setTxs] = useState<Tx[]>([])
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Tx|null>(null)
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])
  const [form, setForm] = useState({ title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',transaction_date:new Date().toISOString().split('T')[0],status:'confirmed' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string|null>(null)
  const [showStatusMenu, setShowStatusMenu] = useState<string|null>(null)
  const monthOpts = getMonthOptions()

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const mDate = new Date(selectedMonth)
    const mStart = `${mDate.getFullYear()}-${String(mDate.getMonth()+1).padStart(2,'0')}-01`
    const mEnd = new Date(mDate.getFullYear(), mDate.getMonth()+1, 0).toISOString().split('T')[0]
    let q = supabase.from('transactions').select('*,categories(name)').eq('user_id',user.id).gte('transaction_date',mStart).lte('transaction_date',mEnd).order('transaction_date',{ascending:false})
    if (filter==='expense') q = q.eq('type','expense')
    else if (filter==='income') q = q.eq('type','income')
    const { data } = await q
    setTxs(data||[])
    const { data:cats } = await supabase.from('categories').select('id,name').or(`user_id.eq.${user.id},user_id.is.null`).order('name')
    setCategories(cats||[])
  }, [selectedMonth, filter])

  useEffect(() => { load() }, [load])

  function openNew() { setEditing(null); setForm({ title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',transaction_date:new Date().toISOString().split('T')[0],status:'confirmed' }); setShowModal(true) }
  function openEdit(t: Tx) { setEditing(t); setForm({ title:t.title, amount:String(t.amount), type:t.type, category_id:t.category_id||'', payment_method:t.payment_method||'pix', transaction_date:t.transaction_date, status:t.status||'confirmed' }); setShowModal(true) }

  async function save() {
    if (!form.amount) return
    setSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = { title:form.title||'Lancamento', amount:parseFloat(form.amount.replace(',','.')), type:form.type, status:form.status, category_id:form.category_id||null, payment_method:form.payment_method, transaction_date:form.transaction_date }
    if (editing) { await supabase.from('transactions').update(payload).eq('id',editing.id) }
    else { await supabase.from('transactions').insert({ ...payload, user_id:user.id, source:'manual' }) }
    setShowModal(false); setSaving(false); load()
  }

  async function deleteTx(id: string) {
    if (!confirm('Excluir este lancamento?')) return
    setDeleting(id); await supabase.from('transactions').delete().eq('id',id); setDeleting(null); load()
  }

  async function changeStatus(id: string, status: string) {
    await supabase.from('transactions').update({ status }).eq('id',id); setShowStatusMenu(null); load()
  }

  const totalExp = txs.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0)
  const totalInc = txs.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0)

  return (
    <div style={{ minHeight:'100vh',overflow:'hidden' }}>
      <div style={{ background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50 }}>
        <div><div style={{ fontSize:15,fontWeight:700 }}>Lancamentos</div><div style={{ fontSize:11,color:'var(--muted)' }}>{txs.length} registros</div></div>
        <div style={{ display:'flex',gap:8 }}>
          <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={{ width:'auto',padding:'5px 8px',fontSize:11,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC' }}>
            {monthOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={openNew} style={{ padding:'7px 14px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600 }}>+ Novo</button>
        </div>
      </div>
      <div style={{ padding:'14px 16px' }}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12 }}>
          {[{label:'Despesas',value:formatBRL(totalExp),color:'var(--danger)'},{label:'Receitas',value:formatBRL(totalInc),color:'var(--success)'},{label:'Saldo',value:formatBRL(totalInc-totalExp),color:totalInc-totalExp>=0?'var(--success)':'var(--danger)'}].map((k,i)=>(
            <div key={i} style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px',borderTop:`3px solid ${k.color}` }}>
              <div style={{ fontSize:9,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:3 }}>{k.label}</div>
              <div style={{ fontSize:13,fontWeight:800,color:k.color,fontFamily:'JetBrains Mono,monospace' }}>{k.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex',gap:6,marginBottom:12 }}>
          {[{v:'all',l:'Todos'},{v:'expense',l:'Despesas'},{v:'income',l:'Receitas'}].map(f=>(
            <button key={f.v} onClick={()=>setFilter(f.v)} style={{ padding:'5px 12px',border:'1.5px solid',borderColor:filter===f.v?'var(--accent)':'var(--border)',borderRadius:20,fontSize:12,fontWeight:600,background:filter===f.v?'var(--accent-light)':'#fff',color:filter===f.v?'var(--accent)':'var(--muted)',cursor:'pointer' }}>{f.l}</button>
          ))}
        </div>
        {txs.length===0 ? (
          <div style={{ textAlign:'center',padding:'40px 20px',color:'var(--muted)' }}>
            <div style={{ fontSize:32,marginBottom:10 }}>📭</div>
            <div style={{ fontWeight:600,marginBottom:12 }}>Nenhum lancamento neste periodo</div>
            <button onClick={openNew} style={{ padding:'8px 20px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600 }}>+ Adicionar</button>
          </div>
        ) : (
          <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden' }}>
            {txs.map((t,i)=>{
              const si=STATUS_OPTS.find(o=>o.v===t.status)||STATUS_OPTS[0]
              return (
                <div key={t.id} style={{ padding:'11px 14px',borderBottom:i<txs.length-1?'1px solid #F8FAFC':'none' }}>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:8 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0 }}>
                      <div style={{ width:32,height:32,borderRadius:8,background:t.type==='income'?'var(--success-light)':'var(--danger-light)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0,fontWeight:700,color:t.type==='income'?'var(--success)':'var(--danger)' }}>{t.type==='income'?'↑':'↓'}</div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{t.title}{t.source==='whatsapp'&&<span style={{ fontSize:9,background:'#ECFDF5',color:'#065F46',padding:'1px 5px',borderRadius:8,fontWeight:700,marginLeft:5 }}>TG</span>}</div>
                        <div style={{ fontSize:11,color:'var(--muted)',marginTop:1 }}>{formatDate(t.transaction_date)} · {(t.categories as {name:string}|null)?.name||'—'}</div>
                      </div>
                    </div>
                    <span style={{ fontSize:14,fontWeight:800,fontFamily:'JetBrains Mono,monospace',color:t.type==='income'?'var(--success)':'var(--danger)',flexShrink:0 }}>{t.type==='income'?'+':'-'}{formatBRL(t.amount)}</span>
                  </div>
                  <div style={{ display:'flex',gap:6,marginTop:8,flexWrap:'wrap' }}>
                    <div style={{ position:'relative' }}>
                      <button onClick={()=>setShowStatusMenu(showStatusMenu===t.id?null:t.id)} style={{ padding:'3px 9px',background:si.bg,color:si.color,border:`1px solid ${si.color}33`,borderRadius:20,fontSize:11,fontWeight:700 }}>{si.l} ▾</button>
                      {showStatusMenu===t.id&&(
                        <div style={{ position:'absolute',top:'100%',left:0,marginTop:4,background:'#fff',border:'1px solid var(--border)',borderRadius:10,boxShadow:'var(--shadow-md)',zIndex:100,minWidth:130,overflow:'hidden' }}>
                          {STATUS_OPTS.map(o=><button key={o.v} onClick={()=>changeStatus(t.id,o.v)} style={{ display:'block',width:'100%',textAlign:'left',padding:'9px 14px',background:t.status===o.v?o.bg:'#fff',color:o.color,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',borderBottom:'1px solid #F8FAFC' }}>{t.status===o.v?'✓ ':''}{o.l}</button>)}
                        </div>
                      )}
                    </div>
                    <button onClick={()=>openEdit(t)} style={{ padding:'3px 9px',background:'#F1F5F9',color:'#475569',border:'1px solid var(--border)',borderRadius:20,fontSize:11,fontWeight:600 }}>✏ Editar</button>
                    <button onClick={()=>deleteTx(t.id)} disabled={deleting===t.id} style={{ padding:'3px 9px',background:'var(--danger-light)',color:'var(--danger)',border:'1px solid #FECACA',borderRadius:20,fontSize:11,fontWeight:600 }}>{deleting===t.id?'…':'🗑 Excluir'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {showModal&&(
        <div onClick={e=>{ if(e.target===e.currentTarget) setShowModal(false) }} style={{ position:'fixed',inset:0,background:'rgba(15,23,42,.5)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center' }}>
          <div style={{ background:'#fff',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:540,padding:'20px 16px 32px',maxHeight:'92vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <div style={{ fontSize:15,fontWeight:700 }}>{editing?'Editar Lancamento':'Novo Lancamento'}</div>
              <button onClick={()=>setShowModal(false)} style={{ background:'#F1F5F9',border:'none',borderRadius:8,width:28,height:28,fontSize:14 }}>✕</button>
            </div>
            {!editing&&<div style={{ display:'flex',gap:4,background:'#F1F5F9',padding:4,borderRadius:8,marginBottom:14 }}>{[{v:'expense',l:'Despesa'},{v:'income',l:'Receita'}].map(tp=><button key={tp.v} onClick={()=>setForm(f=>({...f,type:tp.v}))} style={{ flex:1,padding:'7px',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600,background:form.type===tp.v?'#fff':'transparent',color:form.type===tp.v?'var(--text)':'var(--muted)' }}>{tp.l}</button>)}</div>}
            <div style={{ marginBottom:12 }}><label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>Descricao</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Mercado, Gasolina..."/></div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
              <div><label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>Valor</label><input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>Data</label><input type="date" value={form.transaction_date} onChange={e=>setForm(f=>({...f,transaction_date:e.target.value}))}/></div>
            </div>
            <div style={{ marginBottom:12 }}><label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{STATUS_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
            <div style={{ marginBottom:12 }}><label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>Categoria</label><select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}><option value="">Selecionar...</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div style={{ marginBottom:16 }}><label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>Pagamento</label><select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}><option value="pix">PIX</option><option value="debit">Debito</option><option value="credit">Credito</option><option value="cash">Dinheiro</option><option value="transfer">Transferencia</option></select></div>
            <div style={{ display:'flex',gap:8 }}><button onClick={()=>setShowModal(false)} style={{ flex:1,padding:11,border:'1.5px solid var(--border)',borderRadius:8,background:'#fff',fontSize:13,fontWeight:600,color:'var(--muted)' }}>Cancelar</button><button onClick={save} disabled={saving} style={{ flex:2,padding:11,background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,opacity:saving?0.7:1 }}>{saving?'Salvando...':editing?'Salvar':'Adicionar'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
