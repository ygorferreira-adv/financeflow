'use client'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
const nav = [
  {href:'/dashboard',label:'Dashboard',icon:'⬡'},
  {href:'/bills',label:'Contas',icon:'◫'},
  {href:'/transactions',label:'Lancamentos',icon:'⟷'},
  {href:'/reports',label:'Relatorios',icon:'◈'},
  {href:'/settings',label:'Config',icon:'◎'},
]
export default function Sidebar() {
  const path = usePathname()
  const active = (href: string) => path===href||path.startsWith(href+'/')
  return (
    <>
      <aside className="desktop-sidebar" style={{width:240,background:'var(--sidebar)',minHeight:'100vh',display:'flex',flexDirection:'column',position:'fixed',top:0,left:0,zIndex:100,borderRight:'1px solid rgba(255,255,255,.05)'}}>
        <a href="/dashboard" style={{display:'flex',alignItems:'center',gap:10,padding:'20px 20px 24px',textDecoration:'none',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
          <div style={{width:32,height:32,background:'var(--accent)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:'#fff',letterSpacing:'-0.3px'}}>FinanceFlow</div>
            <div style={{fontSize:10,color:'#64748B',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.5px'}}>Controle Financeiro</div>
          </div>
        </a>
        <div style={{flex:1,padding:'16px 12px'}}>
          <div style={{fontSize:10,fontWeight:600,color:'#475569',textTransform:'uppercase',letterSpacing:'0.8px',padding:'0 8px',marginBottom:8}}>Menu</div>
          {nav.map(item=>{const isActive=active(item.href);return(
            <a key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 10px',borderRadius:8,textDecoration:'none',marginBottom:2,fontSize:13.5,fontWeight:isActive?600:400,background:isActive?'rgba(29,78,216,.3)':'transparent',color:isActive?'#fff':'#94A3B8',borderLeft:isActive?'3px solid var(--accent)':'3px solid transparent'}}>
              <span style={{fontSize:15,opacity:isActive?1:.6}}>{item.icon}</span>{item.label}
            </a>
          )})}
        </div>
        <div style={{padding:'12px',borderTop:'1px solid rgba(255,255,255,.06)'}}>
          <button onClick={async()=>{await supabase.auth.signOut();window.location.href='/'}} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'9px 10px',background:'transparent',border:'none',borderRadius:8,color:'#64748B',fontSize:13,fontWeight:500}}>⎋ Sair</button>
        </div>
      </aside>
      <nav className="mobile-nav" style={{display:'none',position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:'1px solid var(--border)',zIndex:100,padding:'6px 0 10px',alignItems:'center',justifyContent:'space-around',width:'100%'}}>
        {nav.map(item=>{const isActive=active(item.href);return(
          <a key={item.href} href={item.href} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,textDecoration:'none',padding:'4px 8px',flex:1}}>
            <span style={{fontSize:19,lineHeight:1}}>{item.icon}</span>
            <span style={{fontSize:9,fontWeight:600,color:isActive?'var(--accent)':'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.3px'}}>{item.label.split(' ')[0]}</span>
            {isActive&&<div style={{width:16,height:2,borderRadius:1,background:'var(--accent)',marginTop:1}}/>}
          </a>
        )})}
      </nav>
    </>
  )
}