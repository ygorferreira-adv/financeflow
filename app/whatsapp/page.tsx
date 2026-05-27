'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function WhatsAppPage() {
  const [settings, setSettings] = useState<{whatsapp_connected:boolean;whatsapp_phone:string;whatsapp_provider:string;whatsapp_api_key:string;whatsapp_webhook_secret:string}|null>(null)
  const [form, setForm] = useState({ provider:'meta', phone:'', token:'', phone_id:'' })
  const [saved, setSaved] = useState(false)
  const [messages, setMessages] = useState<{raw_message:string;parsed_type:string;parsed_amount:number|null;created_at:string;status:string}[]>([])

  const WEBHOOK_URL = 'https://xiwotydowokaxhjexfrz.supabase.co/functions/v1/whatsapp-webhook'

  useEffect(() => {
    async function load() {
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: s } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      setSettings(s)
      const { data: msgs } = await supabase.from('whatsapp_messages').select('*').eq('user_id', user.id).order('created_at', { ascending:false }).limit(10)
      setMessages(msgs || [])
    }
    load()
  }, [])

  async function save() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_settings').update({
      whatsapp_connected: true,
      whatsapp_phone: form.phone,
      whatsapp_provider: form.provider,
      whatsapp_api_key: form.token,
    }).eq('user_id', user.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const examples = [
    { msg:'50 gasolina', result:'Despesa R$50 · Transporte · Hoje' },
    { msg:'paguei 80 mercado', result:'Despesa paga R$80 · Mercado · Hoje' },
    { msg:'luz 180 vence dia 10', result:'Conta pendente R$180 · vence dia 10' },
    { msg:'recebi 3000 salário', result:'Receita R$3.000 · Hoje' },
    { msg:'resumo', result:'Mostra saldo, despesas e pendências do mês' },
  ]

  return (
    <div>
      <div style={{ background:'#fff', borderBottom:'1px solid #E5E9F2', padding:'0 28px', height:60, display:'flex', alignItems:'center', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ fontSize:16, fontWeight:700 }}>Integração WhatsApp</div>
      </div>
      <div style={{ padding:'24px 28px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start' }}>
        <div>
          <div className="card" style={{ padding:'24px', marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
              <div style={{ width:50, height:50, background:'#25D366', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:24 }}>💬</span>
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:700 }}>Configurar WhatsApp</div>
                <div style={{ fontSize:12, color:settings?.whatsapp_connected?'#16A34A':'#9AA3B2', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:settings?.whatsapp_connected?'#16A34A':'#9AA3B2', display:'inline-block' }}/>
                  {settings?.whatsapp_connected ? `Conectado · ${settings.whatsapp_phone}` : 'Não conectado'}
                </div>
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.4px' }}>Provedor</label>
              <select value={form.provider} onChange={e=>setForm(f=>({...f,provider:e.target.value}))}>
                <option value="meta">WhatsApp Cloud API (Meta) — Gratuito</option>
                <option value="evolution">Evolution API</option>
                <option value="zapi">Z-API</option>
                <option value="waha">WAHA (self-hosted)</option>
              </select>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.4px' }}>Seu número (com DDD)</label>
              <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="Ex: 5511999998888" />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.4px' }}>Token de Acesso</label>
              <input type="password" value={form.token} onChange={e=>setForm(f=>({...f,token:e.target.value}))} placeholder="Cole o token aqui" />
            </div>
            <div style={{ height:1, background:'#E5E9F2', margin:'16px 0' }}/>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#5A6478', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.4px' }}>URL do Webhook (cole na Meta)</label>
              <div style={{ display:'flex', gap:8 }}>
                <input value={WEBHOOK_URL} readOnly style={{ background:'#F8F9FC', fontFamily:'DM Mono,monospace', fontSize:11 }} />
                <button onClick={()=>navigator.clipboard.writeText(WEBHOOK_URL)} style={{ padding:'0 14px', border:'1px solid #CDD3E0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'DM Sans,sans-serif', whiteSpace:'nowrap' }}>Copiar</button>
              </div>
            </div>
            <button onClick={save} style={{ width:'100%', padding:11, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontSize:14, fontWeight:600 }}>
              {saved ? '✓ Salvo!' : 'Salvar Configurações'}
            </button>
          </div>

          <div className="card" style={{ padding:'20px 24px' }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>Histórico de Mensagens</div>
            {messages.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px', color:'#9AA3B2', fontSize:13 }}>Nenhuma mensagem registrada ainda</div>
            ) : messages.map((m,i) => (
              <div key={i} style={{ padding:'10px 0', borderBottom:'1px solid #E5E9F2' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:600, fontSize:13 }}>{m.raw_message}</span>
                  <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:m.status==='processed'?'#DCFCE7':'#FEF2F2', color:m.status==='processed'?'#16A34A':'#DC2626' }}>{m.status==='processed'?'Processada':'Falhou'}</span>
                </div>
                {m.parsed_amount && <div style={{ fontSize:11, color:'#9AA3B2', marginTop:2 }}>{m.parsed_type} · R$ {m.parsed_amount.toFixed(2).replace('.',',')}</div>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card" style={{ padding:'20px 24px', marginBottom:20 }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>Como usar</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {examples.map((e,i) => (
                <div key={i} style={{ border:'1px solid #E5E9F2', borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#9AA3B2', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Você envia</div>
                  <div style={{ background:'#e7ffdb', color:'#0a3d1f', padding:'8px 12px', borderRadius:6, fontSize:13.5, fontWeight:600, marginBottom:8 }}>{e.msg}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:'#16A34A' }}>✅ {e.result}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding:'20px 24px' }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>Categorização Automática</div>
            <div style={{ fontSize:13, color:'#5A6478', marginBottom:12, lineHeight:1.6 }}>O sistema reconhece palavras-chave e categoriza automaticamente. Se não reconhecer, usa Claude IA para interpretar.</div>
            {[['gasolina, posto, combustível','Transporte'],['mercado, carrefour, atacadão','Mercado'],['ifood, restaurante, lanche','Alimentação'],['luz, energia, cemig','Contas Fixas'],['netflix, spotify, internet','Assinaturas'],['farmácia, médico, consulta','Saúde']].map(([k,c],i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', background:'#F8F9FC', borderRadius:7, marginBottom:6, fontSize:12 }}>
                <span style={{ color:'#5A6478' }}>{k}</span>
                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#EFF4FF', color:'#2563EB' }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
