'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/utils'

interface Cat { id:string;name:string;type:string;color:string;icon:string;is_default:boolean }

export default function CategoriesPage() {
  const [cats, setCats] = useState<Cat[]>([])
  const [totals, setTotals] = useState<Record<string,number>>({})
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name:'', type:'expense', color:'#2563EB', icon:'📦' })

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: c }, { data: cm }] = await Promise.all([
      supabase.from('categories').select('*').or(`user_id.eq.${user.id},user_id.is.null`).order('name'),
      supabase.from('category_monthly').select('*').eq('user_id', user.id)
    ])
    setCats(c || [])
    const t: Record<string,number> = {}
    ;(cm||[]).forEach((r:{category_name:string;total:number}) => { t[r.category_name] = r.total })
    setTotals(t)
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user || !form.name) return
    await supabase.from('categories').insert({ user_id:user.id, ...form })
    setShowModal(false); setForm({ name:'', type:'expense', color:'#2563EB', icon:'📦' }); load()
  }

  return (
    <div>
      <div style={{ background:'#fff', borderBottom:'1px solid #E5E9F2', padding:'0 28px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ fontSize:16, fontWeight:700 }}>Categorias</div>
        <button onClick={()=>setShowModal(true)} style={{ padding:'7px 16px', background:'#2563EB', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>+ Nova Categoria</button>
      </div>
      <div style={{ padding:'24px 28px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {cats.map(c => {
            const total = totals[c.name] || 0
            return (
              <div key={c.id} className="card" style={{ padding:'18px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:'#F0F2F7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{c.icon}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{c.name}</div>
                      <div style={{ fontSize:11, color:'#9AA3B2' }}>{c.type==='expense'?'Despesa':c.type==='income'?'Receita':'Ambos'}</div>
                    </div>
                  </div>
                  {c.is_default && <span style={{ fontSize:10, background:'#F0F2F7', color:'#9AA3B2', padding:'2px 8px', borderRadius:20, fontWeight:600 }}>Padrão</span>}
                </div>
                {total > 0 && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                      <span style={{ color:'#9AA3B2' }}>Gasto no mês</span>
                      <span className="mono" style={{ fontWeight:700 }}>{formatBRL(total)}</span>
                    </div>
                    <div style={{ height:6, background:'#F0F2F7', borderRadius:4 }}>
                      <div style={{ height:'100%', borderRadius:4, background:c.color, width:`${Math.min((total/5000)*100,100)}%` }}/>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      {showModal && (
        <div onClick={e=>{ if(e.target===e.currentTarget) setShowModal(false) }} style={{ position:'fixed', inset:0, background:'rgba(13,17,23,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:16, width:360, padding:28, boxShadow:'0 24px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:700 }}>Nova Categoria</div>
              <button onClick={()=>setShowModal(false)} style={{ background:'#F0F2F7', border:'none', borderRadius:6, width:32, height:32, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom:12 }}><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Nome</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Pet, Academia..." /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Tipo</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value="expense">Despesa</option><option value="income">Receita</option><option value="both">Ambos</option></select></div>
              <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Cor</label><input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} style={{ height:42, padding:'4px 8px' }} /></div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button onClick={()=>setShowModal(false)} style={{ flex:1, padding:11, border:'1px solid #CDD3E0', borderRadius:8, background:'#fff', cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:600 }}>Cancelar</button>
              <button onClick={save} style={{ flex:2, padding:11, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:600 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
