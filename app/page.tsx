'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name } }
        })
        if (error) throw error
        setMode('login')
        setError('Conta criada! Faça login.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F0F2F7' }}>
      <div style={{ width:420, background:'#fff', borderRadius:16, padding:40, boxShadow:'0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:32 }}>
          <div style={{ width:40, height:40, background:'#2563EB', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:'#0D1117' }}>FinanceFlow</div>
            <div style={{ fontSize:12, color:'#9AA3B2' }}>Controle financeiro pessoal</div>
          </div>
        </div>

        <div style={{ display:'flex', background:'#F0F2F7', borderRadius:8, padding:4, marginBottom:24 }}>
          {(['login','register'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex:1, padding:'7px 0', border:'none', borderRadius:6, cursor:'pointer',
              fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:600,
              background: mode===m ? '#fff' : 'transparent',
              color: mode===m ? '#0D1117' : '#9AA3B2',
              boxShadow: mode===m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition:'all 0.15s'
            }}>
              {m === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#5A6478', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.4px' }}>Nome</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome completo" required />
            </div>
          )}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#5A6478', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.4px' }}>E-mail</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#5A6478', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.4px' }}>Senha</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>
          {error && (
            <div style={{ padding:'10px 14px', borderRadius:8, background: error.includes('criada') ? '#DCFCE7' : '#FEF2F2', color: error.includes('criada') ? '#16A34A' : '#DC2626', fontSize:13, marginBottom:16 }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            width:'100%', padding:'11px 0', background:'#2563EB', color:'#fff',
            border:'none', borderRadius:8, fontSize:14, fontWeight:600,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            fontFamily:'DM Sans,sans-serif'
          }}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  )
}
