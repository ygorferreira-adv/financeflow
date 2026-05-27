import Sidebar from "@/components/layout/Sidebar"
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div style={{ display:"flex" }}><Sidebar /><div style={{ marginLeft:240, flex:1, minHeight:"100vh" }}>{children}</div></div>
}
