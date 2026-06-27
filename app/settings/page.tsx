'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [profile, setProfile] = useState({ name:'',email:'' })
  const [tgCode, setTgCode] = useState('')
  const [tgConnected, setTgConnected] = useState(false)
  const [saved, setSaved] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    async function load() {
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const [{ data:p },{ data:s }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id',user.id).single(),
        supabase.from('user_settings').select('*').eq('user_id',user.id).single(),
      ])
      if (p) setProfile({ name:p.name, email:p.email })
      if (s) {
        setTgCode(s.telegram_link_code||'')
        setTgConnected(s.telegram_connected||false)
      }
    }
    load()
  }, [])

  async function saveProfile() {
    await supabase.from('profiles').update({ name:profile.name }).eq('id',userId)
    setSaved('Perfil salvo!'); setTimeout(()=>setSaved(''),3000)
  }

  async function genCode() {
    const { data } = await supabase.from('user_settings').update({ telegram_link_code: Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2) }).eq('user_id',userId).select().single()
    setTgCode(data?.telegram_link_code||'')
  }

  const tgLink = `https://t.me/Financeflow_control_bot?start=${tgCode}`

  return (
    <div>
      <div style={{ background:'#fff',borderBottom:'1px solid #E5E9F2',padding:'0 16px',height:56,display:'flex',alignItems:'center' }}>
        <div style={{ fontSize:15,fontWeight:700 }}>Configurações</div>
      </div>
      <div style={{ padding:'16px',display:'flex',flexDirection:'column',gap:14 }}>

        {/* Perfil */}
        <div style={{ background:'#fff',border:'1px solid #E5E9F2',borderRadius:14,padding:'16px' }}>
          <div style={{ fontSize:14,fontWeight:700,marginBottom:14 }}>Perfil</div>
          <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16 }}>
            <div style={{ width:48,height:48,borderRadius:'50%',background:'linear-gradient(135deg,#2563EB,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:18,color:'#fff',flexShrink:0 }}>{profile.name?profile.name[0].toUpperCase():'Y'}</div>
            <div>
              <div style={{ fontWeight:700,fontSize:15 }}>{profile.name}</div>
              <div style={{ fontSize:12,color:'#9AA3B2' }}>{profile.email}</div>
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block',fontSize:11,fontWeight:600,color:'#5A6478',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.4px' }}>Nome</label>
            <input value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))}/>
          </div>
          <button onClick={saveProfile} style={{ width:'100%',padding:11,background:'#2563EB',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:600 }}>Salvar Perfil</button>
          {saved && <div style={{ marginTop:10,padding:'8px 12px',borderRadius:8,background:'#DCFCE7',color:'#16A34A',fontSize:13,fontWeight:600,textAlign:'center' }}>✓ {saved}</div>}
        </div>

        {/* Telegram */}
        <div style={{ background:'#fff',border:'1px solid #E5E9F2',borderRadius:14,padding:'16px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:14 }}>
            <div style={{ width:36,height:36,background:'#0088CC',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>✈️</div>
            <div>
              <div style={{ fontSize:14,fontWeight:700 }}>Telegram Bot</div>
              <div style={{ fontSize:12,fontWeight:600,color:tgConnected?'#16A34A':'#9AA3B2',display:'flex',alignItems:'center',gap:4 }}>
                <span style={{ width:7,height:7,borderRadius:'50%',background:tgConnected?'#16A34A':'#CDD3E0',display:'inline-block' }}/>
                {tgConnected?'Conectado':'Não conectado'}
              </div>
            </div>
          </div>

          {tgConnected ? (
            <div>
              <div style={{ padding:'10px 14px',background:'#DCFCE7',borderRadius:10,fontSize:13,color:'#16A34A',fontWeight:600,marginBottom:12 }}>
                ✅ Bot conectado! Use @Financeflow_control_bot no Telegram.
              </div>
              <div style={{ fontSize:13,color:'#5A6478',marginBottom:12 }}>Comandos disponíveis:</div>
              {[['50 gasolina','Registra despesa R$50'],['paguei 80 mercado','Despesa paga'],['recebi 3000 salário','Receita'],['luz 180 vence dia 10','Conta a pagar'],['resumo','Ver saldo do mês']].map(([cmd,desc])=>(
                <div key={cmd} style={{ display:'flex',gap:10,marginBottom:8,alignItems:'center' }}>
                  <code style={{ background:'#F0F2F7',padding:'3px 8px',borderRadius:6,fontSize:12,fontWeight:600,fontFamily:'DM Mono,monospace',whiteSpace:'nowrap' }}>{cmd}</code>
                  <span style={{ fontSize:12,color:'#9AA3B2' }}>{desc}</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <p style={{ fontSize:13,color:'#5A6478',marginBottom:14,lineHeight:1.6 }}>Conecte o Telegram para registrar despesas enviando mensagens simples como "50 gasolina".</p>
              {tgCode ? (
                <div>
                  <a href={tgLink} target="_blank" rel="noopener noreferrer" style={{ display:'block',width:'100%',padding:13,background:'#0088CC',color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:700,textAlign:'center',textDecoration:'none',marginBottom:10 }}>
                    ✈️ Abrir Telegram e Conectar
                  </a>
                  <div style={{ fontSize:11,color:'#9AA3B2',textAlign:'center' }}>Ou pesquise @Financeflow_control_bot e envie: <code style={{ fontFamily:'DM Mono,monospace' }}>/start {tgCode}</code></div>
                </div>
              ) : (
                <button onClick={genCode} style={{ width:'100%',padding:12,background:'#0088CC',color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:700 }}>
                  Gerar Link de Conexão
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sair */}
        <button onClick={async()=>{ await supabase.auth.signOut(); window.location.href='/' }} style={{ width:'100%',padding:12,background:'#FEF2F2',color:'#DC2626',border:'1px solid #FECACA',borderRadius:10,cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:600 }}>
          🚪 Sair da conta
        </button>
      </div>
    </div>
  )
}
