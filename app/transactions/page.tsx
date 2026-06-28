'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate, monthStart, monthEnd, monthLabel } from '@/lib/utils'

function monthOpts(){const o=[];for(let i=-5;i<=2;i++){const s=monthStart(i);o.push({value:s,label:monthLabel(s)})};return o}

const STATUSES=[
  {v:'confirmed',l:'Confirmado',c:'var(--success)',bg:'var(--success-l)'},
  {v:'pending',l:'Pendente',c:'var(--warn)',bg:'var(--warn-l)'},
  {v:'cancelled',l:'Cancelado',c:'var(--muted)',bg:'#F9FAFB'},
]

export default function TransactionsPage(){
  const [month,setMonth]=useState(monthStart(0))
  const [txs,setTxs]=useState<any[]>([])
  const [filter,setFilter]=useState('all')
  const [cats,setCats]=useState<any[]>([])
  const [showModal,setShowModal]=useState(false)
  const [editing,setEditing]=useState<any>(null)
  const [form,setForm]=useState({title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',date:new Date().toISOString().split('T')[0],status:'confirmed'})
  const [saving,setSaving]=useState(false)
  const [deleting,setDeleting]=useState<string|null>(null)
  const [statusMenu,setStatusMenu]=useState<string|null>(null)
  const [err,setErr]=useState('')
  const opts=monthOpts()

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return
    const mS=month, mE=monthEnd(month)
    let q=supabase.from('transactions').select('*,categories(name)')
      .eq('user_id',user.id).gte('transaction_date',mS).lte('transaction_date',mE)
      .order('transaction_date',{ascending:false})
    if(filter==='expense') q=q.eq('type','expense')
    else if(filter==='income') q=q.eq('type','income')
    const {data}=await q
    setTxs(data||[])
    const {data:c}=await supabase.from('categories').select('id,name').or(`user_id.eq.${user.id},user_id.is.null`).order('name')
    setCats(c||[])
  },[month,filter])

  useEffect(()=>{load()},[load])

  function openNew(){setEditing(null);setErr('');setForm({title:'',amount:'',type:'expense',category_id:'',payment_method:'pix',date:new Date().toISOString().split('T')[0],status:'confirmed'});setShowModal(true)}
  function openEdit(t:any){setEditing(t);setErr('');setForm({title:t.title,amount:String(t.amount),type:t.type,category_id:t.category_id||'',payment_method:t.payment_method||'pix',date:t.transaction_date,status:t.status||'confirmed'});setShowModal(true)}

  async function save(){
    setErr('')
    if(!form.amount){setErr('Informe o valor');return}
    const amt=parseFloat(form.amount.replace(',','.'))
    if(isNaN(amt)||amt<=0){setErr('Valor inválido');return}
    setSaving(true)
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return
    const p={title:form.title||'Lançamento',amount:amt,type:form.type,status:form.status,category_id:form.category_id||null,payment_method:form.payment_method,transaction_date:form.date}
    if(editing){await supabase.from('transactions').update(p).eq('id',editing.id)}
    else{await supabase.from('transactions').insert({...p,user_id:user.id,source:'manual'})}
    setShowModal(false);setSaving(false);load()
  }

  async function del(id:string){
    if(!confirm('Excluir este lançamento?'))return
    setDeleting(id);await supabase.from('transactions').delete().eq('id',id);setDeleting(null);load()
  }
  async function setStatus(id:string,status:string){
    await supabase.from('transactions').update({status}).eq('id',id);setStatusMenu(null);load()
  }

  const confirmed=txs.filter((t:any)=>t.status==='confirmed')
  const totalExp=confirmed.filter((t:any)=>t.type==='expense').reduce((a:any,t:any)=>a+Number(t.amount),0)
  const totalInc=confirmed.filter((t:any)=>t.type==='income').reduce((a:any,t:any)=>a+Number(t.amount),0)

  return(<div onClick={()=>statusMenu&&setStatusMenu(null)}>
    <div style={{background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50,gap:8}}>
      <div style={{flexShrink:0}}>
        <div style={{fontSize:15,fontWeight:700}}>Lançamentos</div>
        <div style={{fontSize:10,color:'var(--muted)'}}>{txs.length} registros</div>
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <select value={month} onChange={e=>setMonth(e.target.value)} style={{width:'auto',padding:'5px 8px',fontSize:11,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC'}}>
          {opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={openNew} style={{padding:'7px 14px',background:'var(--accent)',color:'#fff',borderRadius:8,fontSize:12,fontWeight:600}}>+ Novo</button>
      </div>
    </div>

    <div style={{padding:'14px 16px'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
        {[{l:'Despesas',v:formatBRL(totalExp),c:'var(--danger)'},{l:'Receitas',v:formatBRL(totalInc),c:'var(--success)'},{l:'Saldo',v:formatBRL(totalInc-totalExp),c:totalInc-totalExp>=0?'var(--success)':'var(--danger)'}].map((k,i)=>(
          <div key={i} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px',borderTop:`3px solid ${k.c}`}}>
            <div style={{fontSize:9,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:3}}>{k.l}</div>
            <div style={{fontSize:13,fontWeight:800,color:k.c,fontFamily:'JetBrains Mono,monospace'}}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:6,marginBottom:12}}>
        {[{v:'all',l:'Todos'},{v:'expense',l:'Despesas'},{v:'income',l:'Receitas'}].map(f=>(
          <button key={f.v} onClick={()=>setFilter(f.v)} style={{padding:'5px 12px',border:'1.5px solid',borderColor:filter===f.v?'var(--accent)':'var(--border)',borderRadius:20,fontSize:12,fontWeight:600,background:filter===f.v?'var(--accent-l)':'#fff',color:filter===f.v?'var(--accent)':'var(--muted)'}}>{f.l}</button>
        ))}
      </div>

      {txs.length===0?(
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'40px',textAlign:'center',color:'var(--muted)'}}>
          <div style={{fontSize:28,marginBottom:8}}>📭</div>
          <div style={{fontWeight:600,marginBottom:12}}>Nenhum lançamento neste período</div>
          <button onClick={openNew} style={{padding:'7px 18px',background:'var(--accent)',color:'#fff',borderRadius:8,fontSize:12,fontWeight:600}}>+ Adicionar</button>
        </div>
      ):(
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
          {txs.map((t:any,i:number)=>{
            const si=STATUSES.find(s=>s.v===t.status)||STATUSES[0]
            return(<div key={t.id} style={{padding:'11px 14px',borderBottom:i<txs.length-1?'1px solid #F8FAFC':'none'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
                  <div style={{width:32,height:32,borderRadius:8,background:t.type==='income'?'var(--success-l)':'var(--danger-l)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:t.type==='income'?'var(--success)':'var(--danger)',flexShrink:0}}>{t.type==='income'?'↑':'↓'}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {t.title}
                      {t.source==='whatsapp'&&<span style={{fontSize:9,background:'#ECFDF5',color:'#065F46',padding:'1px 5px',borderRadius:6,fontWeight:700,marginLeft:5}}>BOT</span>}
                    </div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>{formatDate(t.transaction_date)} · {t.categories?.name||'—'}</div>
                  </div>
                </div>
                <span style={{fontSize:14,fontWeight:800,fontFamily:'JetBrains Mono,monospace',color:t.type==='income'?'var(--success)':'var(--danger)',flexShrink:0}}>{t.type==='income'?'+':'-'}{formatBRL(Number(t.amount))}</span>
              </div>
              <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}} onClick={e=>e.stopPropagation()}>
                <div style={{position:'relative'}}>
                  <button onClick={()=>setStatusMenu(statusMenu===t.id?null:t.id)} style={{padding:'3px 9px',background:si.bg,color:si.c,border:`1px solid ${si.c}33`,borderRadius:20,fontSize:11,fontWeight:700}}>{si.l} ▾</button>
                  {statusMenu===t.id&&(
                    <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,background:'#fff',border:'1px solid var(--border)',borderRadius:10,boxShadow:'var(--sh2)',zIndex:100,minWidth:130,overflow:'hidden'}}>
                      {STATUSES.map(s=><button key={s.v} onClick={()=>setStatus(t.id,s.v)} style={{display:'block',width:'100%',textAlign:'left',padding:'9px 14px',background:t.status===s.v?s.bg:'#fff',color:s.c,border:'none',fontSize:12,fontWeight:600,borderBottom:'1px solid #F8FAFC'}}>{t.status===s.v?'✓ ':''}{s.l}</button>)}
                    </div>
                  )}
                </div>
                <button onClick={()=>openEdit(t)} style={{padding:'3px 9px',background:'#F1F5F9',color:'#475569',border:'1px solid var(--border)',borderRadius:20,fontSize:11,fontWeight:600}}>✏ Editar</button>
                <button onClick={()=>del(t.id)} disabled={deleting===t.id} style={{padding:'3px 9px',background:'var(--danger-l)',color:'var(--danger)',border:'1px solid #FECACA',borderRadius:20,fontSize:11,fontWeight:600}}>{deleting===t.id?'…':'🗑'}</button>
              </div>
            </div>)
          })}
        </div>
      )}
    </div>

    {showModal&&(
      <div onClick={e=>{if(e.target===e.currentTarget)setShowModal(false)}} style={{position:'fixed',inset:0,background:'rgba(15,23,42,.5)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
        <div style={{background:'#fff',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:520,padding:'18px 16px 32px',maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontSize:15,fontWeight:700}}>{editing?'Editar Lançamento':'Novo Lançamento'}</div>
            <button onClick={()=>setShowModal(false)} style={{background:'#F1F5F9',borderRadius:8,width:28,height:28,fontSize:14}}>✕</button>
          </div>
          {err&&<div style={{marginBottom:12,padding:'9px 12px',background:'var(--danger-l)',border:'1px solid #FECACA',borderRadius:8,fontSize:12,fontWeight:600,color:'var(--danger)'}}>⚠ {err}</div>}
          {!editing&&<div style={{display:'flex',gap:4,background:'#F1F5F9',padding:4,borderRadius:8,marginBottom:14}}>
            {[{v:'expense',l:'💳 Despesa'},{v:'income',l:'💰 Receita'}].map(tp=>(
              <button key={tp.v} onClick={()=>setForm(f=>({...f,type:tp.v}))} style={{flex:1,padding:'7px',borderRadius:6,fontSize:12,fontWeight:600,background:form.type===tp.v?'#fff':'transparent',color:form.type===tp.v?'var(--text)':'var(--muted)'}}>{tp.l}</button>
            ))}
          </div>}
          {[{k:'title',l:'Descrição',p:'Ex: Mercado, Gasolina...'}].map(f=>(
            <div key={f.k} style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>{f.l}</label>
              <input value={(form as any)[f.k]} onChange={e=>setForm(prev=>({...prev,[f.k]:e.target.value}))} placeholder={f.p}/>
            </div>
          ))}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Valor *</label><input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" inputMode="decimal"/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Data</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
          </div>
          <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{STATUSES.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
          <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Categoria</label><select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}><option value="">Selecionar...</option>{cats.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div style={{marginBottom:16}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Pagamento</label><select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}><option value="pix">PIX</option><option value="debit">Débito</option><option value="credit">Crédito</option><option value="cash">Dinheiro</option></select></div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setShowModal(false)} style={{flex:1,padding:11,border:'1.5px solid var(--border)',borderRadius:8,background:'#fff',fontSize:13,fontWeight:600,color:'var(--muted)'}}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{flex:2,padding:11,background:saving?'#93C5FD':'var(--accent)',color:'#fff',borderRadius:8,fontSize:13,fontWeight:700}}>{saving?'Salvando...':editing?'Salvar':'Adicionar'}</button>
          </div>
        </div>
      </div>
    )}
  </div>)
}
