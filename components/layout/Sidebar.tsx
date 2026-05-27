'use client'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const nav = [
  { href:'/dashboard', label:'Dashboard' },
  { href:'/bills', label:'Contas a Pagar', badge:true },
  { href:'/transactions', label:'Lançamentos' },
  { href:'/categories', label:'Categorias' },
  { href:'/reports', label:'Relatórios' },
]

export default function Sidebar() {
  const path = usePathname()
  const isActive = (href: string) => path === href || path.startsWith(href + '/')

  return (
    <aside className="sidebar" style={{ width:240, minHeight:'100vh', display:'flex', flexDirection:'column', padding:'24px 0', position:'fixed', top:0, left:0, zIndex:100 }}>
      <a href="/dashboard" style={{ padding:'0 20px 28px', display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
        <div style={{ width:36, height:36, background:'#2563EB', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:'#fff' }}>FinanceFlow</div>
          <div style={{ fontSize:10, color:'#8B9BB0' }}>Controle financeiro</div>
        </div>
      </a>
      <div style={{ padding:'0 12px', flex:1 }}>
        {nav.map(item => (
          <a key={item.href} href={item.href} className={`nav-item${isActive(item.href)?' active':''}`} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, cursor:'pointer', textDecoration:'none', marginBottom:2, fontSize:13.5, fontWeight:500, transition:'all 0.15s' }}>
            {item.label}
            {item.badge && <span style={{ marginLeft:'auto', background:'#DC2626', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:20 }}>3</span>}
          </a>
        ))}
        <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'12px 0' }}/>
        {[{href:'/whatsapp',label:'WhatsApp'},{href:'/settings',label:'Configurações'}].map(item => (
          <a key={item.href} href={item.href} className={`nav-item${isActive(item.href)?' active':''}`} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, cursor:'pointer', textDecoration:'none', marginBottom:2, fontSize:13.5, fontWeight:500 }}>
            {item.label}
          </a>
        ))}
      </div>
      <div style={{ padding:'12px 12px 0', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={async()=>{ await supabase.auth.signOut(); window.location.href='/' }} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderRadius:9, cursor:'pointer', background:'transparent', border:'none', width:'100%', color:'#8B9BB0', fontSize:13, fontFamily:'DM Sans,sans-serif' }}>
          Sair da conta
        </button>
      </div>
    </aside>
  )
}
