import Sidebar from '@/components/layout/Sidebar'
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{display:'flex',width:'100%',overflow:'hidden'}}>
      <Sidebar/>
      <div className="main-content" style={{marginLeft:240,flex:1,minHeight:'100vh',background:'var(--bg)',width:'calc(100% - 240px)'}}>
        {children}
      </div>
    </div>
  )
}