'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate } from '@/lib/utils'

interface Tx { id:string;title:string;amount:number;type:string;transaction_date:string;payment_method:string;status:string;source:string;categories?:{name:string}|null }

function getMonthOptions() {
  const opts = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
    opts.push({ value:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, label:d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) })
  }
  return opts
}

export default function TransactionsPage() {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [txs, setTxs] = useState<Tx[]>([])
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])
  const [form, setForm] = useState({ title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',transaction_date:new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string|null>(null)
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

  useEffect(()=>{ load() },[load])

  async function save() {
    if (!form.amount) return
    setSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').insert({ user_id:user.id, title:form.title||'Lançamento', amount:parseFloat(form.amount.replace(',','.')), type:form.type, status:'confirmed', category_id:form.category_id||null, payment_method:form.payment_method, transaction_date:form.transaction_date, source:'manual' })
    setShowModal(false)
    setForm({ title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',transaction_date:new Date().toISOString().split('T')[0] })
    setSaving(false); load()
  }

  async function deleteTx(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    setDeleting(id)
    await supabase.from('transactions').delete().eq('id',id)
    setDeleting(null); load()
  }

  const totalExp = txs.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0)
  const totalInc = txs.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0)

  const pmIcon = (pm:string) => ({pix:'⚡',debit:'💳',credit:'💳',cash:'💵',transfer:'→'})[pm]||'·'

  return (
    <div>
      <div style={{ background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 20px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50,boxShadow:'var(--shadow)' }}>
        <div>
          <div style={{ fontSize:16,fontWeight:700,letterSpacing:'-0.3px' }}>Lançamentos</div>
          <div style={{ fontSize:11,color:'var(--muted)',fontWeight:500 }}>{txs.length} registros</div>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={{ width:'auto',padding:'6px 10px',fontSize:12,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC' }}>
            {monthOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={()=>setShowModal(true)} style={{ padding:'7px 14px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600 }}>+ Novo</button>
        </div>
      </div>

      <div style={{ padding:'20px' }}>
        {/* Resumo */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16 }}>
          <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:'14px',borderLeft:'3px solid var(--danger)' }}>
            <div style={{ fontSize:10,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>Total Despesas</div>
            <div style={{ fontSize:18,fontWeight:800,color:'var(--danger)',fontFamily:'JetBrains Mono,monospace' }}>{formatBRL(totalExp)}</div>
          </div>
          <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:'14px',borderLeft:'3px solid var(--success)' }}>
            <div style={{ fontSize:10,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>Total Receitas</div>
            <div style={{ fontSize:18,fontWeight:800,color:'var(--success)',fontFamily:'JetBrains Mono,monospace' }}>{formatBRL(totalInc)}</div>
          </div>
          <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:'14px',borderLeft:`3px solid ${totalInc-totalExp>=0?'var(--success)':'var(--danger)'}` }}>
            <div style={{ fontSize:10,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>Saldo</div>
            <div style={{ fontSize:18,fontWeight:800,color:totalInc-totalExp>=0?'var(--success)':'var(--danger)',fontFamily:'JetBrains Mono,monospace' }}>{formatBRL(totalInc-totalExp)}</div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display:'flex',gap:6,marginBottom:14 }}>
          {[{v:'all',l:'Todos'},{v:'expense',l:'Despesas'},{v:'income',l:'Receitas'}].map(f=>(
            <button key={f.v} onClick={()=>setFilter(f.v)} style={{ padding:'6px 14px',border:'1.5px solid',borderColor:filter===f.v?'var(--accent)':'var(--border)',borderRadius:20,fontSize:12,fontWeight:600,background:filter===f.v?'var(--accent-light)':'#fff',color:filter===f.v?'var(--accent)':'var(--muted)',cursor:'pointer' }}>{f.l}</button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow)' }}>
          {txs.length===0 ? (
            <div style={{ padding:'40px',textAlign:'center',color:'var(--muted)' }}>
              <div style={{ fontSize:32,marginBottom:10 }}>📭</div>
              <div style={{ fontSize:13,fontWeight:600 }}>Nenhum lançamento neste período</div>
              <button onClick={()=>setShowModal(true)} style={{ marginTop:14,padding:'8px 20px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer' }}>+ Adicionar</button>
            </div>
          ) : txs.map((t,i)=>(
            <div key={t.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:i<txs.length-1?'1px solid #F8FAFC':'none',transition:'background 0.1s' }}>
              <div style={{ display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0 }}>
                <div style={{ width:36,height:36,borderRadius:10,background:t.type==='income'?'var(--success-light)':'var(--danger-light)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0,fontWeight:700,color:t.type==='income'?'var(--success)':'var(--danger)' }}>
                  {t.type==='income'?'↑':'↓'}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                    {t.title}
                    {t.source==='whatsapp' && <span style={{ fontSize:9,background:'#ECFDF5',color:'#065F46',padding:'1px 5px',borderRadius:8,fontWeight:700,marginLeft:6,textTransform:'uppercase' }}>Telegram</span>}
                  </div>
                  <div style={{ fontSize:11,color:'var(--muted)',fontWeight:500,marginTop:1 }}>
                    {formatDate(t.transaction_date)} · {(t.categories as {name:string}|null)?.name||'Sem categoria'} · {pmIcon(t.payment_method)} {t.payment_method.toUpperCase()}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
                <span style={{ fontSize:14,fontWeight:800,fontFamily:'JetBrains Mono,monospace',color:t.type==='income'?'var(--success)':'var(--danger)',letterSpacing:'-0.5px' }}>
                  {t.type==='income'?'+':'-'}{formatBRL(t.amount)}
                </span>
                <button onClick={()=>deleteTx(t.id)} disabled={deleting===t.id} title="Excluir" style={{ width:28,height:28,background:'var(--danger-light)',color:'var(--danger)',border:'1px solid #FECACA',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  {deleting===t.id?'…':'✕'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div onClick={e=>{ if(e.target===e.currentTarget) setShowModal(false) }} style={{ position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center',backdropFilter:'blur(2px)' }}>
          <div style={{ background:'#fff',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:520,padding:'20px 20px 32px',maxHeight:'92vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
              <div style={{ fontSize:15,fontWeight:700 }}>Novo Lançamento</div>
              <button onClick={()=>setShowModal(false)} style={{ background:'#F1F5F9',border:'none',borderRadius:8,width:28,height:28,cursor:'pointer',fontSize:14 }}>✕</button>
            </div>
            <div style={{ display:'flex',gap:4,background:'#F1F5F9',padding:4,borderRadius:8,marginBottom:14 }}>
              {[{v:'expense',l:'💳 Despesa'},{v:'income',l:'💰 Receita'}].map(t=>(
                <button key={t.v} onClick={()=>setForm(f=>({...f,type:t.v}))} style={{ flex:1,padding:'7px',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:600,background:form.type===t.v?'#fff':'transparent',color:form.type===t.v?'var(--text)':'var(--muted)',boxShadow:form.type===t.v?'var(--shadow)':'none' }}>{t.l}</button>
              ))}
            </div>
            {[{k:'title',l:'Descrição',ph:'Ex: Mercado, Gasolina...',type:'text'}].map(f=>(
              <div key={f.k} style={{ marginBottom:12 }}>
                <label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>{f.l}</label>
                <input type={f.type} value={form[f.k as keyof typeof form]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph}/>
              </div>
            ))}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
              <div><label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>Valor (R$)</label><input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>Data</label><input type="date" value={form.transaction_date} onChange={e=>setForm(f=>({...f,transaction_date:e.target.value}))}/></div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>Categoria</label>
              <select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}><option value="">Selecionar...</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px' }}>Pagamento</label>
              <select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}><option value="pix">PIX</option><option value="debit">Débito</option><option value="credit">Crédito</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option></select>
            </div>
            <div style={{ display:'flex',gap:8 }}>
              <button onClick={()=>setShowModal(false)} style={{ flex:1,padding:11,border:'1.5px solid var(--border)',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--muted)' }}>Cancelar</button>
              <button onClick={save} disabled={saving} style={{ flex:2,padding:11,background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,opacity:saving?0.7:1 }}>{saving?'Salvando...':'Salvar Lançamento'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
