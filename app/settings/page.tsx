'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [profile, setProfile] = useState({ name:'', email:'' })
  const [prefs, setPrefs] = useState({ monthly_budget:'', alert_days_before:'3', notif_due_tomorrow:true, notif_overdue:true, notif_weekly_summary:false, notif_monthly_summary:true })
  const [saved, setSaved] = useState('')

  useEffect(() => {
    async function load() {
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      ])
      if (p) setProfile({ name:p.name, email:p.email })
      if (s) setPrefs({ monthly_budget: s.monthly_budget||'', alert_days_before: String(s.alert_days_before||3), notif_due_tomorrow: s.notif_due_tomorrow, notif_overdue: s.notif_overdue, notif_weekly_summary: s.notif_weekly_summary, notif_monthly_summary: s.notif_monthly_summary })
    }
    load()
  }, [])

  async function saveProfile() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ name:profile.name }).eq('id', user.id)
    setSaved('Perfil salvo!'); setTimeout(()=>setSaved(''),3000)
  }

  async function savePrefs() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_settings').update({ monthly_budget:parseFloat(prefs.monthly_budget)||0, alert_days_before:parseInt(prefs.alert_days_before), notif_due_tomorrow:prefs.notif_due_tomorrow, notif_overdue:prefs.notif_overdue, notif_weekly_summary:prefs.notif_weekly_summary, notif_monthly_summary:prefs.notif_monthly_summary }).eq('user_id', user.id)
    setSaved('Preferências salvas!'); setTimeout(()=>setSaved(''),3000)
  }

  const Toggle = ({ value, onChange }: { value:boolean; onChange:(v:boolean)=>void }) => (
    <div onClick={()=>onChange(!value)} style={{ width:42, height:24, borderRadius:12, background:value?'#16A34A':'#CDD3E0', cursor:'pointer', position:'relative', transition:'background 0.25s', flexShrink:0 }}>
      <div style={{ position:'absolute', width:18, height:18, background:'#fff', borderRadius:'50%', top:3, left:value?21:3, transition:'left 0.25s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
    </div>
  )

  return (
    <div>
      <div style={{ background:'#fff', borderBottom:'1px solid #E5E9F2', padding:'0 28px', height:60, display:'flex', alignItems:'center', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ fontSize:16, fontWeight:700 }}>Configurações</div>
      </div>
      <div style={{ padding:'24px 28px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start' }}>
        <div>
          <div className="card" style={{ padding:'24px', marginBottom:20 }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Perfil</div>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,#2563EB,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:18, color:'#fff' }}>{profile.name?profile.name[0].toUpperCase():'U'}</div>
              <div>
                <div style={{ fontWeight:700 }}>{profile.name||'Usuário'}</div>
                <div style={{ fontSize:12, color:'#9AA3B2' }}>{profile.email}</div>
              </div>
            </div>
            <div style={{ marginBottom:14 }}><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.4px' }}>Nome</label><input value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))} /></div>
            <div style={{ marginBottom:16 }}><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.4px' }}>E-mail</label><input value={profile.email} readOnly style={{ background:'#F8F9FC', color:'#9AA3B2' }} /></div>
            <button onClick={saveProfile} style={{ padding:'9px 20px', background:'#2563EB', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:600 }}>Salvar Perfil</button>
          </div>
          <div className="card" style={{ padding:'24px' }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Preferências</div>
            {[{ label:'Orçamento Mensal (R$)', key:'monthly_budget', type:'text', ph:'Ex: 5000' },{ label:'Alertar X dias antes do vencimento', key:'alert_days_before', type:'select', opts:['1','2','3','5','7'] }].map((f,i)=>(
              <div key={i} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.4px' }}>{f.label}</label>
                {f.type==='select' ? (
                  <select value={prefs[f.key as keyof typeof prefs] as string} onChange={e=>setPrefs(p=>({...p,[f.key]:e.target.value}))}>
                    {f.opts?.map(o=><option key={o} value={o}>{o} dias</option>)}
                  </select>
                ) : (
                  <input value={prefs[f.key as keyof typeof prefs] as string} onChange={e=>setPrefs(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph} />
                )}
              </div>
            ))}
            <button onClick={savePrefs} style={{ padding:'9px 20px', background:'#2563EB', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:600 }}>Salvar Preferências</button>
          </div>
        </div>
        <div className="card" style={{ padding:'24px' }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Notificações</div>
          {[{ key:'notif_due_tomorrow', label:'Conta vencendo amanhã', sub:'Aviso 24h antes' },{ key:'notif_overdue', label:'Conta vencida', sub:'Alerta imediato' },{ key:'notif_monthly_summary', label:'Resumo mensal', sub:'No 1° dia do mês' },{ key:'notif_weekly_summary', label:'Resumo semanal', sub:'Todo domingo' }].map(n=>(
            <div key={n.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 0', borderBottom:'1px solid #E5E9F2' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{n.label}</div>
                <div style={{ fontSize:11, color:'#9AA3B2' }}>{n.sub}</div>
              </div>
              <Toggle value={prefs[n.key as keyof typeof prefs] as boolean} onChange={v=>setPrefs(p=>({...p,[n.key]:v}))} />
            </div>
          ))}
          {saved && <div style={{ marginTop:16, padding:'10px 14px', borderRadius:8, background:'#DCFCE7', color:'#16A34A', fontSize:13, fontWeight:600 }}>✓ {saved}</div>}
        </div>
      </div>
    </div>
  )
}
