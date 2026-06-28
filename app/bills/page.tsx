'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate } from '@/lib/utils'

interface Bill { id:string;title:string;amount:number;due_date:string;status:string;live_status:string;category_name:string;category_id:string;recurrence:string }

const STATUS_OPTS = [
  { v:'pending', l:'A Pagar', color:'#D97706', bg:'#FFFBEB' },
  { v:'paid', l:'Pago', color:'#16A34A', bg:'#F0FDF4' },
  { v:'overdue', l:'Vencida', color:'#DC2626', bg:'#FEF2F2' },
  { v:'cancelled', l:'Cancelada', color:'#6B7280', bg:'#F9FAFB' },
]

function getMonthOptions() {
  const opts = [{value:'all',label:'Todos os meses'}]
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    opts.push({ value:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, label:d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) })
  }
  return opts
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [filter, setFilter] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Bill|null>(null)
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])
  const [form, setForm] = useState({ title:'',amount:'',due_date:'',category_id:'',recurrence:'once',status:'pending' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string|null>(null)
  const [showStatusMenu, setShowStatusMenu] = useState<string|null>(null)
  const monthOpts = getMonthOptions()

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    let q = supabase.from('bills_live').select('*').eq('user_id',user.id).neq('status','cancelled')
    if (selectedMonth !== 'all') {
      const mDate = new Date(selectedMonth)
      const mEnd = new Date(mDate.getFullYear(), mDate.getMonth()+1, 0).toISOString().split('T')[0]
      q = q.gte('due_date', selectedMonth).lte('due_date', mEnd)
    }
    if (filter === 'overdue') q = q.eq('live_status','overdue')
    else if (filter === 'paid') q = q.eq('status','paid')
    else if (filter === 'pending') q = q.eq('status','pending')
    const { data } = await q.order('due_date')
    setBills(data||[])
    const { data:cats } = await supabase.from('categories').select('id,name').or(`user_id.eq.${user.id},user_id.is.null`).order('name')
    setCategories(cats||[])
  }, [filter, selectedMonth])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setForm({ title:'',amount:'',due_date:'',category_id:'',recurrence:'once',status:'pending' })
    setShowModal(true)
  }

  function openEdit(b: Bill) {
    setEditing(b)
    setForm({ title:b.title, amount:String(b.amount), due_date:b.due_date, category_id:b.category_id||'', recurrence:b.recurrence||'once', status:b.status })
    setShowModal(true)
  }

  async function save() {
    if (!form.title || !form.amount || !form.due_date) return
    setSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = { title:form.title, amount:parseFloat(form.amount.replace(',','.')), due_date:form.due_date, status:form.status, category_id:form.category_id||null, recurrence:form.recurrence, payment_method:'pix' }
    if (editing) {
      await supabase.from('bills').update(payload).eq('id',editing.id)
    } else {
      await supabase.from('bills').insert({ ...payload, user_id:user.id })
    }
    setShowModal(false); setSaving(false); load()
  }

  async function deleteBill(id: string) {
    if (!confirm('Excluir esta conta?')) return
    setDeleting(id)
    await supabase.from('bills').delete().eq('id',id)
    setDeleting(null); load()
  }

  async function changeStatus(id: string, status: string) {
    await supabase.from('bills').update({ status }).eq('id',id)
    setShowStatusMenu(null); load()
  }

  const totalPending = bills.filter(b=>b.status!=='paid').reduce((a,b)=>a+b.amount,0)
  const statusInfo = (b: Bill) => {
    const s = b.live_status === 'overdue' ? 'overdue' : b.status === 'paid' ? 'paid' : 'pending'
    return STATUS_OPTS.find(o=>o.v===s) || STATUS_OPTS[0]
  }

  return (
    <div style={{ minHeight:'100vh', overflow:'hidden' }}>
      {/* TOPBAR */}
      <div style={{ background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50 }}>
        <div>
          <div style={{ fontSize:15,fontWeight:700 }}>Contas a Pagar</div>
          <div style={{ fontSize:11,color:'var(--muted)' }}>Pendente: {formatBRL(totalPending)}</div>
        </div>
        <button onClick={openNew} style={{ padding:'7px 14px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600 }}>+ Nova</button>
      </div>

      <div style={{ padding:'14px 16px' }}>
        {/* Filtros */}
        <div style={{ display:'flex',gap:6,marginBottom:10,overflowX:'auto',paddingBottom:2 }}>
          <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={{ width:'auto',padding:'5px 8px',fontSize:12,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC',flexShrink:0 }}>
            {monthOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {[{v:'all',l:'Todas'},{v:'pending',l:'Pendentes'},{v:'overdue',l:'Vencidas'},{v:'paid',l:'Pagas'}].map(f=>(
            <button key={f.v} onClick={()=>setFilter(f.v)} style={{ padding:'5px 12px',border:'1.5px solid',borderColor:filter===f.v?'var(--accent)':'var(--border)',borderRadius:20,fontSize:12,fontWeight:600,background:filter===f.v?'var(--accent-light)':'#fff',color:filter===f.v?'var(--accent)':'var(--muted)',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0 }}>{f.l}</button>
          ))}
        </div>

        {/* Lista */}
        {bills.length === 0 ? (
          <div style={{ textAlign:'center',padding:'48px 20px',color:'var(--muted)' }}>
            <div style={{ fontSize:36,marginBottom:10 }}>🎉</div>
            <div style={{ fontWeight:600,marginBottom:12 }}>Nenhuma conta aqui</div>
            <button onClick={openNew} style={{ padding:'8px 20px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600 }}>+ Adicionar conta</button>
          </div>
        ) : (
          <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden' }}>
            {bills.map((b,i) => {
              const si = statusInfo(b)
              const isOverdue = b.live_status==='overdue' && b.status!=='paid'
              return (
                <div key={b.id} style={{ padding:'12px 14px',borderBottom:i<bills.length-1?'1px solid #F8FAFC':'none',background:isOverdue?'#FFFAFA':'#fff' }}>
                  <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8 }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{b.title}</div>
                      <div style={{ fontSize:11,color:'var(--muted)',marginTop:2 }}>
                        {b.category_name||'—'} · {formatDate(b.due_date)}
                        {b.recurrence==='monthly'&&<span style={{ marginLeft:6,fontSize:10,background:'#EFF6FF',color:'var(--accent)',padding:'1px 5px',borderRadius:8,fontWeight:600 }}>Mensal</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:'right',flexShrink:0 }}>
                      <div style={{ fontSize:14,fontWeight:800,fontFamily:'JetBrains Mono,monospace',color:isOverdue?'var(--danger)':b.status==='paid'?'var(--success)':'var(--text)',letterSpacing:'-0.5px' }}>{formatBRL(b.amount)}</div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display:'flex',gap:6,marginTop:10,flexWrap:'wrap' }}>
                    {/* Status badge + menu */}
                    <div style={{ position:'relative' }}>
                      <button onClick={()=>setShowStatusMenu(showStatusMenu===b.id?null:b.id)} style={{ padding:'4px 10px',background:si.bg,color:si.color,border:`1px solid ${si.color}33`,borderRadius:20,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',gap:4 }}>
                        {si.l} ▾
                      </button>
                      {showStatusMenu===b.id && (
                        <div style={{ position:'absolute',top:'100%',left:0,marginTop:4,background:'#fff',border:'1px solid var(--border)',borderRadius:10,boxShadow:'var(--shadow-md)',zIndex:100,minWidth:130,overflow:'hidden' }}>
                          {STATUS_OPTS.map(o=>(
                            <button key={o.v} onClick={()=>changeStatus(b.id,o.v)} style={{ display:'block',width:'100%',textAlign:'left',padding:'9px 14px',background:b.status===o.v?o.bg:'#fff',color:o.color,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',borderBottom:'1px solid #F8FAFC' }}>
                              {b.status===o.v?'✓ ':''}{o.l}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button onClick={()=>openEdit(b)} style={{ padding:'4px 10px',background:'#F1F5F9',color:'#475569',border:'1px solid var(--border)',borderRadius:20,fontSize:11,fontWeight:600 }}>✏ Editar</button>
                    <button onClick={()=>deleteBill(b.id)} disabled={deleting===b.id} style={{ padding:'4px 10px',background:'var(--danger-light)',color:'var(--danger)',border:'1px solid #FECACA',borderRadius:20,fontSize:11,fontWeight:600 }}>{deleting===b.id?'…':'🗑 Excluir'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div onClick={e=>{ if(e.target===e.currentTarget){setShowModal(false);setShowStatusMenu(null)} }} style={{ position:'fixed',inset:0,background:'rgba(15,23,42,.5)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center' }}>
          <div style={{ background:'#fff',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:540,padding:'20px 16px 32px',maxHeight:'92vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <div style={{ fontSize:15,fontWeight:700 }}>{editing?'Editar Conta':'Nova Conta a Pagar'}</div>
              <button onClick={()=>setShowModal(false)} style={{ background:'#F1F5F9',border:'none',borderRadius:8,width:28,height:28,fontSize:14,color:'var(--muted)' }}>✕</button>
            </div>
            <FG label="Nome"><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Aluguel, Energia..."/></FG>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
              <FG label="Valor"><input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></FG>
              <FG label="Vencimento"><input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/></FG>
            </div>
            <FG label="Status">
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {STATUS_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </FG>
            <FG label="Categoria">
              <select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}>
                <option value="">Selecionar...</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FG>
            <FG label="Recorrência">
              <select value={form.recurrence} onChange={e=>setForm(f=>({...f,recurrence:e.target.value}))}>
                <option value="once">Única vez</option><option value="monthly">Mensal</option><option value="yearly">Anual</option>
              </select>
            </FG>
            <div style={{ display:'flex',gap:8,marginTop:8 }}>
              <button onClick={()=>setShowModal(false)} style={{ flex:1,padding:11,border:'1.5px solid var(--border)',borderRadius:8,background:'#fff',fontSize:13,fontWeight:600,color:'var(--muted)' }}>Cancelar</button>
              <button onClick={save} disabled={saving} style={{ flex:2,padding:11,background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,opacity:saving?0.7:1 }}>{saving?'Salvando...':editing?'Salvar Alterações':'Adicionar Conta'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function FG({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>{label}</label>
      {children}
    </div>
  )
}
