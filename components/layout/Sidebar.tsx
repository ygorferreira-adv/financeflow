'use client'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const nav = [
  { href:'/dashboard', label:'Início', icon:'🏠' },
  { href:'/bills', label:'Contas', icon:'📋' },
  { href:'/transactions', label:'Lançamentos', icon:'💸' },
  { href:'/reports', label:'Relatórios', icon:'📊' },
  { href:'/settings', label:'Config', icon:'⚙️' },
]

export default function Sidebar() {
  const path = usePathname()
  const isActive = (href:string) => path===href||path.startsWith(href+'/')

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="desktop-sidebar" style={{ width:220,background:'#0D1B2A',minHeight:'100vh',display:'flex',flexDirection:'column',padding:'20px 0',position:'fixed',top:0,left:0,zIndex:100 }}>
        <a href="/dashboard" style={{ padding:'0 16px 24px',display:'flex',alignItems:'center',gap:10,textDecoration:'none' }}>
          <div style={{ width:34,height:34,background:'#2563EB',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div>
            <div style={{ fontSize:16,fontWeight:700,color:'#fff' }}>FinanceFlow</div>
            <div style={{ fontSize:10,color:'#8B9BB0' }}>Controle financeiro</div>
          </div>
        </a>
        <div style={{ padding:'0 10px',flex:1 }}>
          {nav.map(item=>(
            <a key={item.href} href={item.href} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 10px',borderRadius:8,cursor:'pointer',textDecoration:'none',marginBottom:2,fontSize:13.5,fontWeight:500,transition:'all 0.15s',background:isActive(item.href)?'rgba(37,99,235,0.25)':'transparent',color:isActive(item.href)?'#fff':'#8B9BB0' }}>
              <span style={{ fontSize:16 }}>{item.icon}</span> {item.label}
            </a>
          ))}
        </div>
        <div style={{ padding:'12px 10px 0',borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={async()=>{ await supabase.auth.signOut(); window.location.href='/' }} style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:8,cursor:'pointer',background:'transparent',border:'none',width:'100%',color:'#8B9BB0',fontSize:13,fontFamily:'DM Sans,sans-serif' }}>
            🚪 Sair
          </button>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <nav className="mobile-nav" style={{ display:'none',position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:'1px solid #E5E9F2',zIndex:100,padding:'6px 0 8px' }}>
        <div style={{ display:'flex',justifyContent:'space-around' }}>
          {nav.map(item=>(
            <a key={item.href} href={item.href} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:2,textDecoration:'none',padding:'4px 8px',borderRadius:8,minWidth:48 }}>
              <span style={{ fontSize:20 }}>{item.icon}</span>
              <span style={{ fontSize:10,fontWeight:600,color:isActive(item.href)?'#2563EB':'#9AA3B2' }}>{item.label}</span>
              {isActive(item.href) && <div style={{ width:4,height:4,borderRadius:'50%',background:'#2563EB' }}/>}
            </a>
          ))}
        </div>
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-nav { display: block !important; }
          .main-content { margin-left: 0 !important; padding-bottom: 70px !important; }
        }
      `}</style>
    </>
  )
}
