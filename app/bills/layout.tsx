import Sidebar from '@/components/layout/Sidebar'
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'flex' }}>
      <Sidebar />
      <div className="main-content" style={{ marginLeft:220, flex:1, minHeight:'100vh' }}>
        {children}
      </div>
    </div>
  )
}
