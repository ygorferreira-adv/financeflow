'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
export default function SettingsPage() {
  const [profile,setProfile]=useState({name:'',email:''})
  const [tgCode,setTgCode]=useState('')
  const [tgConnected,setTgConnected]=useState(false)
  const [saved,setSaved]=useState('')
  const [userId,setUserId]=useState('')
  useEffect(()=>{
    async function load(){
      const{data:{user}}=await supabase.auth.getUser()
      if(!user)return
      setUserId(user.id)
      const[{data:p},{data:s}]=await Promise.all([supabase.from('profiles').select('*').eq('id',user.id).single(),supabase.from('user_settings').select('*').eq('user_id',user.id).single()])
      if(p)setProfile({name:p.name||'',email:p.email||''})
      if(s){setTgCode(s.telegram_link_code||'');setTgConnected(!!(s.telegram_connected&&s.telegram_chat_id))}
    }
    load()
  },[])
  async function saveProfile(){await supabase.from('profiles').update({name:profile.name}).eq('id',userId);setSaved('Salvo!');setTimeout(()=>setSaved(''),3000)}
  async function genCode(){const c=Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,6);await supabase.from('user_settings').update({telegram_link_code:c}).eq('user_id',userId);setTgCode(c)}
  async function disconnect(){await supabase.from('user_settings').update({telegram_connected:false,telegram_chat_id:null}).eq('user_id',userId);setTgConnected(false)}
  const tgLink=`https://t.me/Financeflow_control_bot?start=${tgCode}`
  return(
    <div style={{minHeight:'100vh',overflow:'hidden'}}>
      <div style={{background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 16px',height:56,display:'flex',alignItems:'center'}}><div style={{fontSize:15,fontWeight:700}}>Configuracoes</div></div>
      <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:14}}>
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,#1D4ED8,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:18,color:'#fff',flexShrink:0}}>{profile.name?profile.name[0].toUpperCase():'Y'}</div>
            <div><div style={{fontWeight:700,fontSize:15}}>{profile.name}</div><div style={{fontSize:12,color:'var(--muted)'}}>{profile.email}</div></div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{display:'block',fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'}}>Nome</label>
            <input value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))}/>
          </div>
          <button onClick={saveProfile} style={{width:'100%',padding:11,background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>Salvar Perfil</button>
          {saved&&<div style={{marginTop:10,padding:'8px 12px',borderRadius:8,background:'var(--success-light)',color:'var(--success)',fontSize:13,fontWeight:600,textAlign:'center'}}>✓ {saved}</div>}
        </div>
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
            <div style={{width:38,height:38,background:'#0088CC',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'#fff',fontWeight:700}}>✈</div>
            <div>
              <div style={{fontSize:14,fontWeight:700}}>Telegram Bot</div>
              <div style={{fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:5,marginTop:2}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:tgConnected?'var(--success)':'#D1D5DB'}}/>
                <span style={{color:tgConnected?'var(--success)':'var(--muted)'}}>{tgConnected?'Conectado':'Nao conectado'}</span>
              </div>
            </div>
          </div>
          {tgConnected?(
            <div>
              <div style={{padding:'10px 14px',background:'var(--success-light)',borderRadius:10,fontSize:13,color:'var(--success)',fontWeight:600,marginBottom:12}}>Bot conectado! Use @Financeflow_control_bot</div>
              <div style={{marginBottom:14}}>
                {[['50 gasolina','Despesa'],['salao 700','Despesa'],['recebi 3000 salario','Receita'],['luz 180 vence dia 10','Conta'],['internet 150 todo dia 20','Fixa mensal'],['resumo','Saldo']].map(([c,d])=>(
                  <div key={c} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    <code style={{background:'#F1F5F9',padding:'2px 8px',borderRadius:6,fontSize:11,fontFamily:'JetBrains Mono,monospace',flexShrink:0}}>{c}</code>
                    <span style={{fontSize:11,color:'var(--muted)'}}>{d}</span>
                  </div>
                ))}
              </div>
              <button onClick={disconnect} style={{width:'100%',padding:10,background:'var(--danger-light)',color:'var(--danger)',border:'1px solid #FECACA',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>Desconectar</button>
            </div>
          ):(
            <div>
              <p style={{fontSize:13,color:'var(--muted)',marginBottom:14,lineHeight:1.6}}>Conecte o Telegram para lancar despesas por mensagem.</p>
              {tgCode?(
                <div>
                  <a href={tgLink} target="_blank" rel="noopener noreferrer" style={{display:'block',width:'100%',padding:13,background:'#0088CC',color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700,textAlign:'center',marginBottom:10}}>✈ Abrir Telegram e Conectar</a>
                  <div style={{fontSize:11,color:'var(--muted)',textAlign:'center'}}>Ou envie <code style={{fontFamily:'JetBrains Mono,monospace',background:'#F1F5F9',padding:'1px 6px',borderRadius:4}}>/start {tgCode}</code></div>
                </div>
              ):(
                <button onClick={genCode} style={{width:'100%',padding:12,background:'#0088CC',color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700}}>Gerar Link de Conexao</button>
              )}
            </div>
          )}
        </div>
        <button onClick={async()=>{await supabase.auth.signOut();window.location.href='/'}} style={{width:'100%',padding:12,background:'var(--danger-light)',color:'var(--danger)',border:'1px solid #FECACA',borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:600}}>Sair da conta</button>
      </div>
    </div>
  )
}
