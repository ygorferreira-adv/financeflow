'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate, monthStart, monthEnd, monthLabel } from '@/lib/utils'

function monthOpts(){const o=[{value:'all',label:'Todos os meses'}];for(let i=-1;i<=6;i++){const s=monthStart(i);o.push({value:s,label:monthLabel(s)})};return o}
const STATUSES=[{v:'pending',l:'A Pagar',c:'var(--warn)',bg:'var(--warn-l)'},{v:'paid',l:'Pago',c:'var(--success)',bg:'var(--success-l)'},{v:'overdue',l:'Vencida',c:'var(--danger)',bg:'var(--danger-l)'},{v:'cancelled',l:'Cancelada',c:'var(--muted)',bg:'#F9FAFB'}]
type Sort='due_date_asc'|'due_date_desc'|'amount_asc'|'amount_desc'

export default function BillsPage(){
  const [month,setMonth]=useState('all')
  const [filter,setFilter]=useState('all')
  const [sort,setSort]=useState<Sort>('due_date_asc')
  const [bills,setBills]=useState<any[]>([])
  const [cats,setCats]=useState<any[]>([])
  const [showModal,setShowModal]=useState(false)
  const [editing,setEditing]=useState<any>(null)
  const [form,setForm]=useState({title:'',amount:'',due_date:'',category_id:'',recurrence:'once',status:'pending'})
  const [saving,setSaving]=useState(false)
  const [deleting,setDeleting]=useState<string|null>(null)
  const [statusMenu,setStatusMenu]=useState<string|null>(null)
  const [err,setErr]=useState('')
  const opts=monthOpts()

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return
    let q=supabase.from('bills_live').select('*').eq('user_id',user.id).neq('status','cancelled')
    if(month!=='all'){q=q.gte('due_date',month).lte('due_date',monthEnd(month))}
    if(filter==='overdue') q=q.eq('live_status','overdue')
    else if(filter==='paid') q=q.eq('status','paid')
    else if(filter==='pending') q=q.eq('status','pending')
    const {data}=await q
    const sorted=(data||[]).sort((a:any,b:any)=>{
      if(sort==='due_date_asc') return new Date(a.due_date).getTime()-new Date(b.due_date).getTime()
      if(sort==='due_date_desc') return new Date(b.due_date).getTime()-new Date(a.due_date).getTime()
      if(sort==='amount_desc') return b.amount-a.amount
      return a.amount-b.amount
    })
    setBills(sorted)
    const {data:c}=await supabase.from('categories').select('id,name').or(`user_id.eq.${user.id},user_id.is.null`).order('name')
    setCats(c||[])
  },[month,filter,sort])

  useEffect(()=>{load()},[load])

  function openNew(){setEditing(null);setErr('');setForm({title:'',amount:'',due_date:'',category_id:'',recurrence:'once',status:'pending'});setShowModal(true)}
  function openEdit(b:any){setEditing(b);setErr('');setForm({title:b.title,amount:String(b.amount),due_date:b.due_date,category_id:b.category_id||'',recurrence:b.recurrence||'once',status:b.status});setShowModal(true)}

  async function save(){
    setErr('')
    if(!form.title.trim()){setErr('Informe o nome');return}
    if(!form.amount){setErr('Informe o valor');return}
    if(!form.due_date){setErr('Informe o vencimento');return}
    const amt=parseFloat(form.amount.replace(',','.'))
    if(isNaN(amt)||amt<=0){setErr('Valor inválido');return}
    setSaving(true)
    try{
      const {data:{user}}=await supabase.auth.getUser()
      if(!user)return
      const p={title:form.title.trim(),amount:amt,due_date:form.due_date,status:form.status,category_id:form.category_id||null,recurrence:form.recurrence,payment_method:'pix'}
      const {error}=editing?await supabase.from('bills').update(p).eq('id',editing.id):await supabase.from('bills').insert({...p,user_id:user.id})
      if(error){setErr('Erro: '+error.message);setSaving(false);return}
      setShowModal(false);load()
    }catch(e:any){setErr('Erro: '+String(e?.message||e))}
    setSaving(false)
  }

  async function del(id:string){
    if(!confirm('Excluir esta conta?'))return
    setDeleting(id);await supabase.from('bills').delete().eq('id',id);setDeleting(null);load()
  }
  async function setStatus(id:string,s:string){await supabase.from('bills').update({status:s}).eq('id',id);setStatusMenu(null);load()}

  const totalPend=bills.filter((b:any)=>b.status!=='paid').reduce((a:any,b:any)=>a+Number(b.amount),0)

  return(<div onClick={()=>statusMenu&&setStatusMenu(null)}>
    <div style={{background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50}}>
      <div>
        <div style={{fontSize:15,fontWeight:700}}>Contas a Pagar</div>
        <div style={{fontSize:10,color:'var(--muted)'}}>Total pendente: {formatBRL(totalPend)}</div>
      </div>
      <button onClick={openNew} style={{padding:'7px 14px',background:'var(--accent)',color:'#fff',borderRadius:8,fontSize:12,fontWeight:600}}>+ Nova</button>
    </div>

    <div style={{padding:'12px 14px'}}>
      <div style={{display:'flex',gap:6,marginBottom:8,overflowX:'auto',paddingBottom:2}}>
        <select value={month} onChange={e=>setMonth(e.target.value)} style={{width:'auto',padding:'5px 8px',fontSize:11,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC',flexShrink:0}}>
          {opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {[{v:'all',l:'Todas'},{v:'pending',l:'Pendentes'},{v:'overdue',l:'Vencidas'},{v:'paid',l:'Pagas'}].map(f=>(
          <button key={f.v} onClick={()=>setFilter(f.v)} style={{padding:'5px 10px',border:'1.5px solid',borderColor:filter===f.v?'var(--accent)':'var(--border)',borderRadius:20,fontSize:11,fontWeight:600,background:filter===f.v?'var(--accent-l)':'#fff',color:filter===f.v?'var(--accent)':'var(--muted)',whiteSpace:'nowrap',flexShrink:0}}>{f.l}</button>
        ))}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <span style={{fontSize:10,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.4px',flexShrink:0}}>Ordenar:</span>
        <select value={sort} onChange={e=>setSort(e.target.value as Sort)} style={{flex:1,padding:'5px 8px',fontSize:11,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC'}}>
          <option value="due_date_asc">Vencimento ↑ (mais próximo)</option>
          <option value="due_date_desc">Vencimento ↓ (mais distante)</option>
          <option value="amount_desc">Valor ↓ (maior primeiro)</option>
          <option value="amount_asc">Valor ↑ (menor primeiro)</option>
        </select>
      </div>

      {bills.length===0?(
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'40px',textAlign:'center',color:'var(--muted)'}}>
          <div style={{fontSize:28,marginBottom:8}}>🎉</div>
          <div style={{fontWeight:600,marginBottom:12}}>Nenhuma conta aqui</div>
          <button onClick={openNew} style={{padding:'7px 18px',background:'var(--accent)',color:'#fff',borderRadius:8,fontSize:12,fontWeight:600}}>+ Adicionar</button>
        </div>
      ):(
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
          {bills.map((b:any,i:number)=>{
            const isOver=b.live_status==='overdue'&&b.status!=='paid'
            const isPaid=b.status==='paid'
            const si=STATUSES.find(s=>s.v===(isOver?'overdue':isPaid?'paid':'pending'))||STATUSES[0]
            return(<div key={b.id} style={{padding:'11px 14px',borderBottom:i<bills.length-1?'1px solid #F8FAFC':'none',background:isOver?'#FFFAFA':'#fff'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:isPaid?'line-through':'none',color:isPaid?'var(--muted)':'var(--text)'}}>{b.title}</div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>
                    {b.category_name||'—'} · {formatDate(b.due_date)}
                    {b.recurrence==='monthly'&&<span style={{marginLeft:5,fontSize:9,background:'var(--accent-l)',color:'var(--accent)',padding:'1px 5px',borderRadius:6,fontWeight:600}}>Mensal</span>}
                    {isOver&&<span style={{marginLeft:5,fontSize:9,background:'var(--danger-l)',color:'var(--danger)',padding:'1px 5px',borderRadius:6,fontWeight:700}}>VENCIDA</span>}
                  </div>
                </div>
                <div style={{fontSize:14,fontWeight:800,fontFamily:'JetBrains Mono,monospace',color:isOver?'var(--danger)':isPaid?'var(--success)':'var(--text)',flexShrink:0}}>{formatBRL(Number(b.amount))}</div>
              </div>
              <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}} onClick={e=>e.stopPropagation()}>
                <div style={{position:'relative'}}>
                  <button onClick={()=>setStatusMenu(statusMenu===b.id?null:b.id)} style={{padding:'3px 9px',background:si.bg,color:si.c,border:`1px solid ${si.c}33`,borderRadius:20,fontSize:10,fontWeight:700}}>{si.l} ▾</button>
                  {statusMenu===b.id&&(
                    <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,background:'#fff',border:'1px solid var(--border)',borderRadius:10,boxShadow:'var(--sh2)',zIndex:100,minWidth:130,overflow:'hidden'}}>
                      {STATUSES.map(s=><button key={s.v} onClick={()=>setStatus(b.id,s.v)} style={{display:'block',width:'100%',textAlign:'left',padding:'9px 14px',background:b.status===s.v?s.bg:'#fff',color:s.c,border:'none',fontSize:12,fontWeight:600,borderBottom:'1px solid #F8FAFC'}}>{b.status===s.v?'✓ ':''}{s.l}</button>)}
                    </div>
                  )}
                </div>
                <button onClick={()=>openEdit(b)} style={{padding:'3px 9px',background:'#F1F5F9',color:'#475569',border:'1px solid var(--border)',borderRadius:20,fontSize:10,fontWeight:600}}>✏ Editar</button>
                <button onClick={()=>del(b.id)} disabled={deleting===b.id} style={{padding:'3px 9px',background:'var(--danger-l)',color:'var(--danger)',border:'1px solid #FECACA',borderRadius:20,fontSize:10,fontWeight:600}}>{deleting===b.id?'…':'🗑'}</button>
              </div>
            </div>)
          })}
        </div>
      )}
    </div>

    {showModal&&(
      <div onClick={e=>{if(e.target===e.currentTarget){setShowModal(false);setErr('')}}} style={{position:'fixed',inset:0,background:'rgba(15,23,42,.5)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
        <div style={{background:'#fff',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:520,padding:'18px 16px 32px',maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontSize:15,fontWeight:700}}>{editing?'Editar Conta':'Nova Conta a Pagar'}</div>
            <button onClick={()=>{setShowModal(false);setErr('')}} style={{background:'#F1F5F9',borderRadius:8,width:28,height:28,fontSize:14}}>✕</button>
          </div>
          {err&&<div style={{marginBottom:12,padding:'9px 12px',background:'var(--danger-l)',border:'1px solid #FECACA',borderRadius:8,fontSize:12,fontWeight:600,color:'var(--danger)'}}>⚠ {err}</div>}
          <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Nome *</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Aluguel, Energia..." autoFocus/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Valor *</label><input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Vencimento *</label><input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/></div>
          </div>
          <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{STATUSES.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
          <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Categoria</label><select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}><option value="">Selecionar...</option>{cats.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div style={{marginBottom:18}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Recorrência</label><select value={form.recurrence} onChange={e=>setForm(f=>({...f,recurrence:e.target.value}))}><option value="once">Única vez</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{setShowModal(false);setErr('')}} style={{flex:1,padding:11,border:'1.5px solid var(--border)',borderRadius:8,background:'#fff',fontSize:13,fontWeight:600,color:'var(--muted)'}}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{flex:2,padding:11,background:saving?'#93C5FD':'var(--accent)',color:'#fff',borderRadius:8,fontSize:13,fontWeight:700}}>{saving?'Salvando...':editing?'Salvar Alterações':'✓ Adicionar Conta'}</button>
          </div>
        </div>
      </div>
    )}
  </div>)
}
