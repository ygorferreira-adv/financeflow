'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate } from '@/lib/utils'

interface Bill { id:string;title:string;amount:number;due_date:string;status:string;live_status:string;category_name:string;recurrence:string }

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])
  const [form, setForm] = useState({ title:'', amount:'', due_date:'', category_id:'', recurrence:'once', payment_method:'pix', notes:'' })

  const load = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    let q = supabase.from('bills_live').select('*').eq('user_id', user.id).order('due_date')
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setBills(data || [])
    const { data: cats } = await supabase.from('categories').select('id,name').or(`user_id.eq.${user.id},user_id.is.null`)
    setCategories(cats || [])
  }, [filter])

  useEffect(() => { load() }, [load])

  async function save() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user || !form.title || !form.amount || !form.due_date) return
    await supabase.from('bills').insert({ user_id:user.id, title:form.title, amount:parseFloat(form.amount.replace(',','.')), due_date:form.due_date, category_id:form.category_id||null, recurrence:form.recurrence, payment_method:form.payment_method, notes:form.notes||null, status:'pending' })
    setShowModal(false); setForm({ title:'', amount:'', due_date:'', category_id:'', recurrence:'once', payment_method:'pix', notes:'' }); load()
  }

  async function markPaid(id: string) {
    await supabase.from('bills').update({ status:'paid' }).eq('id', id); load()
  }

  const tabs = [{ v:'all', l:'Todas' },{ v:'pending', l:'Pendentes' },{ v:'overdue', l:'Vencidas' },{ v:'paid', l:'Pagas' }]

  return (
    <div>
      <div style={{ background:'#fff', borderBottom:'1px solid #E5E9F2', padding:'0 28px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ fontSize:16, fontWeight:700 }}>Contas a Pagar</div>
        <button onClick={()=>setShowModal(true)} style={{ padding:'7px 16px', background:'#2563EB', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>+ Nova Conta</button>
      </div>
      <div style={{ padding:'24px 28px' }}>
        <div style={{ display:'flex', gap:4, background:'#F0F2F7', padding:4, borderRadius:9, marginBottom:20, width:'fit-content' }}>
          {tabs.map(t => <button key={t.v} onClick={()=>setFilter(t.v)} style={{ padding:'7px 16px', border:'none', borderRadius:7, cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:600, background:filter===t.v?'#fff':'transparent', color:filter===t.v?'#0D1117':'#9AA3B2', boxShadow:filter===t.v?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>{t.l}</button>)}
        </div>
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ borderBottom:'1px solid #E5E9F2' }}>{['Conta','Valor','Vencimento','Categoria','Recorrência','Status',''].map(h=><th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#9AA3B2', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</th>)}</tr></thead>
            <tbody>
              {bills.map(b => (
                <tr key={b.id} style={{ borderBottom:'1px solid #E5E9F2' }}>
                  <td style={{ padding:'13px 16px' }}><div style={{ fontWeight:600, fontSize:13.5 }}>{b.title}</div><div style={{ fontSize:11, color:'#9AA3B2' }}>{b.category_name||'—'}</div></td>
                  <td style={{ padding:'13px 16px' }}><span className="mono" style={{ fontWeight:700 }}>{formatBRL(b.amount)}</span></td>
                  <td style={{ padding:'13px 16px', fontSize:13, color:'#5A6478' }}>{formatDate(b.due_date)}</td>
                  <td style={{ padding:'13px 16px' }}><span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'#EFF4FF', color:'#2563EB' }}>{b.category_name||'—'}</span></td>
                  <td style={{ padding:'13px 16px', fontSize:13, color:'#5A6478' }}>{b.recurrence==='once'?'Única':b.recurrence==='monthly'?'Mensal':b.recurrence==='yearly'?'Anual':'Semanal'}</td>
                  <td style={{ padding:'13px 16px' }}><span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background: b.status==='paid'?'#DCFCE7':b.live_status==='overdue'?'#FEF2F2':'#FFFBEB', color: b.status==='paid'?'#16A34A':b.live_status==='overdue'?'#DC2626':'#D97706' }}>{b.status==='paid'?'✓ Paga':b.live_status==='overdue'?'Vencida':'Pendente'}</span></td>
                  <td style={{ padding:'13px 16px' }}>
                    {b.status !== 'paid' && <button onClick={()=>markPaid(b.id)} style={{ padding:'5px 12px', background:'#DCFCE7', color:'#16A34A', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'DM Sans,sans-serif' }}>Pagar</button>}
                  </td>
                </tr>
              ))}
              {bills.length === 0 && <tr><td colSpan={7} style={{ textAlign:'center', padding:48, color:'#9AA3B2', fontSize:14 }}>Nenhuma conta encontrada</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div onClick={e=>{ if(e.target===e.currentTarget) setShowModal(false) }} style={{ position:'fixed', inset:0, background:'rgba(13,17,23,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:16, width:480, maxWidth:'95vw', padding:28, boxShadow:'0 24px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:700 }}>Nova Conta a Pagar</div>
              <button onClick={()=>setShowModal(false)} style={{ background:'#F0F2F7', border:'none', borderRadius:6, width:32, height:32, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom:12 }}><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Nome da Conta</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Aluguel, Energia..." /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Valor</label><input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" /></div>
              <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Vencimento</label><input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Categoria</label><select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}><option value="">Selecionar...</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Recorrência</label><select value={form.recurrence} onChange={e=>setForm(f=>({...f,recurrence:e.target.value}))}><option value="once">Única</option><option value="monthly">Mensal</option><option value="yearly">Anual</option><option value="weekly">Semanal</option></select></div>
            </div>
            <div style={{ marginBottom:20 }}><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Observações</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Opcional..." /></div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setShowModal(false)} style={{ flex:1, padding:11, border:'1px solid #CDD3E0', borderRadius:8, background:'#fff', cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:600 }}>Cancelar</button>
              <button onClick={save} style={{ flex:2, padding:11, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:600 }}>Salvar Conta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
