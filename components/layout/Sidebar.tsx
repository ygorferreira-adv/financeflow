'use client'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
const nav=[
  {href:'/dashboard',label:'Dashboard',icon:'◈'},
  {href:'/bills',label:'Contas a Pagar',icon:'◫'},
  {href:'/transactions',label:'Lançamentos',icon:'⇄'},
  {href:'/reports',label:'Relatórios',icon:'◉'},
  {href:'/settings',label:'Configurações',icon:'◎'},
]
export default function Sidebar(){
  const path=usePathname()
  const on=(h:string)=>path===h||path.startsWith(h+'/')
  return(<>
    <aside className="desktop-sidebar" style={{width:240,background:'var(--sidebar)',minHeight:'100vh',display:'flex',flexDirection:'column',position:'fixed',top:0,left:0,zIndex:100}}>
      <a href="/dashboard" style={{display:'flex',alignItems:'center',gap:10,padding:'20px 18px 22px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
        <div style={{width:32,height:32,background:'var(--accent)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>FinanceFlow</div>
          <div style={{fontSize:10,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.5px'}}>Controle Financeiro</div>
        </div>
      </a>
      <div style={{flex:1,padding:'14px 10px'}}>
        {nav.map(it=>{const a=on(it.href);return(
          <a key={it.href} href={it.href} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 10px',borderRadius:8,marginBottom:2,fontSize:13,fontWeight:a?600:400,color:a?'#fff':'#94A3B8',background:a?'rgba(29,78,216,.3)':'transparent',borderLeft:a?'3px solid var(--accent)':'3px solid transparent'}}>
            <span style={{fontSize:14,opacity:a?1:.6}}>{it.icon}</span>{it.label}
          </a>
        )})}
      </div>
      <div style={{padding:'10px',borderTop:'1px solid rgba(255,255,255,.06)'}}>
        <button onClick={async()=>{await supabase.auth.signOut();window.location.href='/'}} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'9px 10px',background:'transparent',borderRadius:8,color:'#64748B',fontSize:13}}>⎋ Sair da conta</button>
      </div>
    </aside>
    <nav className="mobile-nav" style={{display:'none',position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:'1px solid var(--border)',zIndex:100,padding:'6px 0 8px',alignItems:'center',justifyContent:'space-around'}}>
      {nav.map(it=>{const a=on(it.href);return(
        <a key={it.href} href={it.href} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,flex:1,padding:'2px 0'}}>
          <span style={{fontSize:18,lineHeight:1}}>{it.icon}</span>
          <span style={{fontSize:9,fontWeight:600,color:a?'var(--accent)':'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.3px'}}>{it.label.split(' ')[0]}</span>
          {a&&<div style={{width:14,height:2,background:'var(--accent)',borderRadius:1}}/>}
        </a>
      )})}
    </nav>
  </>)
}
