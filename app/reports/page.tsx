'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, formatDate, monthStart, monthEnd, monthLabel } from '@/lib/utils'
import { BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,PieChart,Pie,Cell,Legend } from 'recharts'

function mOpts(from=-11,to=3){const o=[];for(let i=from;i<=to;i++){const s=monthStart(i);o.push({value:s,label:monthLabel(s)})};return o}
const COLORS=['#1D4ED8','#7C3AED','#DC2626','#D97706','#16A34A','#0891B2','#9333EA','#C2410C','#0F766E','#6B7280']

export default function ReportsPage(){
  const [tab,setTab]=useState<'month'|'future'>('month')
  const [month,setMonth]=useState(monthStart(0))
  const [fMonth,setFMonth]=useState(monthStart(1))
  const [txs,setTxs]=useState<any[]>([])
  const [chart,setChart]=useState<any[]>([])
  const [futureBills,setFutureBills]=useState<any[]>([])
  const [printing,setPrinting]=useState(false)
  const pastOpts=mOpts(-11,0)
  const futureOpts=mOpts(-1,6)

  const loadMonth=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return
    const mS=month,mE=monthEnd(month)
    const {data}=await supabase.from('transactions').select('*,categories(name)')
      .eq('user_id',user.id).eq('status','confirmed').gte('transaction_date',mS).lte('transaction_date',mE)
    setTxs(data||[])
    const ch=[]
    for(let i=5;i>=0;i--){
      const s=monthStart(-i),e=monthEnd(s)
      const {data:mt}=await supabase.from('transactions').select('amount,type')
        .eq('user_id',user.id).eq('status','confirmed').gte('transaction_date',s).lte('transaction_date',e)
      ch.push({label:new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{month:'short'}),
        despesas:(mt||[]).filter((t:any)=>t.type==='expense').reduce((a:any,t:any)=>a+Number(t.amount),0),
        receitas:(mt||[]).filter((t:any)=>t.type==='income').reduce((a:any,t:any)=>a+Number(t.amount),0)})
    }
    setChart(ch)
  },[month])

  const loadFuture=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return
    const {data}=await supabase.from('bills_live').select('*').eq('user_id',user.id)
      .gte('due_date',fMonth).lte('due_date',monthEnd(fMonth)).neq('status','cancelled').order('due_date')
    setFutureBills(data||[])
  },[fMonth])

  useEffect(()=>{if(tab==='month')loadMonth()},[tab,loadMonth])
  useEffect(()=>{if(tab==='future')loadFuture()},[tab,loadFuture])

  const totalExp=txs.filter((t:any)=>t.type==='expense').reduce((a:any,t:any)=>a+Number(t.amount),0)
  const totalInc=txs.filter((t:any)=>t.type==='income').reduce((a:any,t:any)=>a+Number(t.amount),0)
  const catMap:Record<string,{total:number,count:number}>={};
  txs.filter((t:any)=>t.type==='expense').forEach((t:any)=>{const n=t.categories?.name||'Outros';if(!catMap[n])catMap[n]={total:0,count:0};catMap[n].total+=Number(t.amount);catMap[n].count++})
  const catData=Object.entries(catMap).map(([name,v])=>({name,...v})).sort((a,b)=>b.total-a.total)
  const totalCat=catData.reduce((a,c)=>a+c.total,0)
  const futurePend=futureBills.filter((b:any)=>b.status!=='paid').reduce((a:any,b:any)=>a+Number(b.amount),0)
  const futureTotal=futureBills.reduce((a:any,b:any)=>a+Number(b.amount),0)
  const fMonthLabel=monthLabel(fMonth)
  const today=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})

  function exportPDF(){
    setPrinting(true)
    // Mostrar print-area antes de imprimir
    const el=document.getElementById('print-area')
    if(el)el.style.display='block'
    setTimeout(()=>{
      window.print()
      if(el)el.style.display='none'
      setPrinting(false)
    },400)
  }

  return(<>
    <style>{`
      @media print {
        body>*:not(#print-wrapper){display:none!important;}
        #print-wrapper{display:block!important;position:fixed;top:0;left:0;width:100%;background:white;}
        #print-area{display:block!important;}
        @page{size:A4 portrait;margin:12mm 10mm;}
      }
    `}</style>

    <div>
      <div style={{background:'#fff',borderBottom:'1px solid var(--border)',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50}}>
        <div style={{fontSize:15,fontWeight:700}}>Relatórios</div>
        {tab==='future'&&futureBills.length>0&&(
          <button onClick={exportPDF} disabled={printing} style={{padding:'7px 14px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            {printing?'⏳ Gerando...':'⬇ Exportar PDF'}
          </button>
        )}
      </div>

      <div style={{padding:'14px 16px'}}>
        <div style={{display:'flex',gap:4,background:'#F1F5F9',padding:4,borderRadius:10,marginBottom:14}}>
          <button onClick={()=>setTab('month')} style={{flex:1,padding:'8px',borderRadius:7,fontSize:12,fontWeight:600,background:tab==='month'?'#fff':'transparent',color:tab==='month'?'var(--accent)':'var(--muted)'}}>📊 Por Mês</button>
          <button onClick={()=>setTab('future')} style={{flex:1,padding:'8px',borderRadius:7,fontSize:12,fontWeight:600,background:tab==='future'?'#fff':'transparent',color:tab==='future'?'var(--accent)':'var(--muted)'}}>📋 Contas Futuras</button>
        </div>

        {tab==='month'&&(<div>
          <select value={month} onChange={e=>setMonth(e.target.value)} style={{width:'100%',padding:'8px 10px',fontSize:12,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC',marginBottom:14}}>
            {pastOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
            {[{l:'Despesas',v:formatBRL(totalExp),c:'var(--danger)'},{l:'Receitas',v:formatBRL(totalInc),c:'var(--success)'},{l:'Saldo',v:formatBRL(totalInc-totalExp),c:totalInc-totalExp>=0?'var(--success)':'var(--danger)'}].map((k,i)=>(
              <div key={i} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:'10px',borderTop:`3px solid ${k.c}`,textAlign:'center'}}>
                <div style={{fontSize:9,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:3}}>{k.l}</div>
                <div style={{fontSize:13,fontWeight:800,color:k.c,fontFamily:'JetBrains Mono,monospace'}}>{k.v}</div>
              </div>
            ))}
          </div>
          <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'14px',marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Evolução 6 Meses</div>
            <div style={{fontSize:10,color:'var(--muted)',marginBottom:12}}>Receitas e despesas mensais</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chart} barGap={2}>
                <XAxis dataKey="label" tick={{fontSize:10,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                <YAxis hide/><Tooltip formatter={(v:number)=>formatBRL(v)} contentStyle={{fontSize:11,borderRadius:8}}/>
                <Bar dataKey="receitas" name="Receitas" fill="#16A34A" radius={[3,3,0,0]}/>
                <Bar dataKey="despesas" name="Despesas" fill="#DC2626" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {catData.length>0&&(<div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'14px'}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Despesas por Categoria</div>
            <div style={{fontSize:10,color:'var(--muted)',marginBottom:12}}>{monthLabel(month)}</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart><Pie data={catData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                {catData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Pie>
              <Tooltip formatter={(v:number)=>formatBRL(v)} contentStyle={{fontSize:11,borderRadius:8}}/>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:10}}/></PieChart>
            </ResponsiveContainer>
            {catData.map((c,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 0',borderBottom:i<catData.length-1?'1px solid #F8FAFC':'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:9,height:9,borderRadius:2,background:COLORS[i%COLORS.length]}}/><span style={{fontSize:12,fontWeight:600}}>{c.name}</span><span style={{fontSize:10,color:'var(--muted)'}}>{c.count}x</span></div>
                <div style={{textAlign:'right'}}><div style={{fontSize:12,fontWeight:700,fontFamily:'JetBrains Mono,monospace'}}>{formatBRL(c.total)}</div><div style={{fontSize:9,color:'var(--muted)'}}>{totalCat>0?((c.total/totalCat)*100).toFixed(1):'0'}%</div></div>
              </div>
            ))}
          </div>)}
          {txs.length===0&&<div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'36px',textAlign:'center',color:'var(--muted)'}}><div style={{fontSize:28,marginBottom:8}}>📊</div><div style={{fontSize:13,fontWeight:600}}>Sem dados neste período</div></div>}
        </div>)}

        {tab==='future'&&(<div>
          <select value={fMonth} onChange={e=>setFMonth(e.target.value)} style={{width:'100%',padding:'8px 10px',fontSize:12,fontWeight:600,borderRadius:8,border:'1.5px solid var(--border)',background:'#F8FAFC',marginBottom:14}}>
            {futureOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
            <div style={{background:'var(--danger-l)',border:'1px solid #FECACA',borderRadius:10,padding:'12px'}}>
              <div style={{fontSize:9,fontWeight:700,color:'var(--danger)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:4}}>Total a Pagar</div>
              <div style={{fontSize:18,fontWeight:800,color:'var(--danger)',fontFamily:'JetBrains Mono,monospace'}}>{formatBRL(futurePend)}</div>
            </div>
            <div style={{background:'var(--accent-l)',border:'1px solid #BFDBFE',borderRadius:10,padding:'12px'}}>
              <div style={{fontSize:9,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:4}}>Qtd Contas</div>
              <div style={{fontSize:18,fontWeight:800,color:'var(--accent)',fontFamily:'JetBrains Mono,monospace'}}>{futureBills.filter((b:any)=>b.status!=='paid').length}</div>
            </div>
          </div>
          {futureBills.length===0?(
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'36px',textAlign:'center',color:'var(--muted)'}}><div style={{fontSize:28,marginBottom:8}}>🎉</div><div style={{fontSize:13,fontWeight:600}}>Sem contas neste período</div></div>
          ):(
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:8,padding:'7px 14px',background:'#F8FAFC',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontSize:9,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Conta</div>
                <div style={{fontSize:9,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:'right'}}>Vencimento</div>
                <div style={{fontSize:9,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:'right',minWidth:85}}>Valor</div>
              </div>
              {futureBills.map((b:any,i:number)=>{
                const isPaid=b.status==='paid',isOver=b.live_status==='overdue'&&!isPaid
                return(<div key={b.id} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:8,padding:'10px 14px',borderBottom:i<futureBills.length-1?'1px solid #F8FAFC':'none',background:isPaid?'#F9FAFB':'#fff',alignItems:'center'}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:isPaid?'var(--muted)':'var(--text)',textDecoration:isPaid?'line-through':'none'}}>{b.title}</div>
                    <div style={{display:'flex',gap:4,marginTop:2,flexWrap:'wrap'}}>
                      {b.category_name&&<span style={{fontSize:9,color:'var(--muted)'}}>{b.category_name}</span>}
                      {b.recurrence==='monthly'&&<span style={{fontSize:9,background:'var(--accent-l)',color:'var(--accent)',padding:'1px 4px',borderRadius:5,fontWeight:600}}>Mensal</span>}
                      {isPaid&&<span style={{fontSize:9,background:'var(--success-l)',color:'var(--success)',padding:'1px 4px',borderRadius:5,fontWeight:600}}>✓ Pago</span>}
                      {isOver&&<span style={{fontSize:9,background:'var(--danger-l)',color:'var(--danger)',padding:'1px 4px',borderRadius:5,fontWeight:700}}>Vencida</span>}
                    </div>
                  </div>
                  <div style={{fontSize:11,color:'var(--muted)',fontWeight:500,whiteSpace:'nowrap',textAlign:'right'}}>{formatDate(b.due_date)}</div>
                  <div style={{fontSize:13,fontWeight:800,fontFamily:'JetBrains Mono,monospace',color:isPaid?'var(--success)':isOver?'var(--danger)':'var(--text)',textAlign:'right',minWidth:85}}>{formatBRL(Number(b.amount))}</div>
                </div>)
              })}
              <div style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',background:'#F8FAFC',borderTop:'2px solid var(--border)'}}>
                <span style={{fontSize:12,fontWeight:700}}>Total Pendente</span>
                <span style={{fontSize:14,fontWeight:800,color:'var(--danger)',fontFamily:'JetBrains Mono,monospace'}}>{formatBRL(futurePend)}</span>
              </div>
            </div>
          )}
        </div>)}
      </div>
    </div>

    {/* ÁREA DE IMPRESSÃO PDF */}
    <div id="print-wrapper" style={{display:'none'}}>
      <div id="print-area" style={{fontFamily:'Arial,Helvetica,sans-serif',color:'#111',background:'#fff',padding:'0 2px'}}>

        {/* HEADER */}
        <div style={{background:'#0F172A',padding:'16px 20px',marginBottom:20,borderRadius:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:'#fff'}}>FinanceFlow</div>
            <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>Relatório de Contas a Pagar</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>{fMonthLabel}</div>
            <div style={{fontSize:9,color:'#94A3B8',marginTop:2}}>Emitido em {today}</div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
          {[
            {l:'Total no Período',v:formatBRL(futureTotal),sub:`${futureBills.length} contas`,c:'#1D4ED8',bg:'#EFF6FF',bd:'#BFDBFE'},
            {l:'Total Pendente',v:formatBRL(futurePend),sub:`${futureBills.filter((b:any)=>b.status!=='paid').length} a pagar`,c:'#DC2626',bg:'#FEF2F2',bd:'#FECACA'},
            {l:'Total Pago',v:formatBRL(futureTotal-futurePend),sub:`${futureBills.filter((b:any)=>b.status==='paid').length} pagas`,c:'#16A34A',bg:'#F0FDF4',bd:'#BBF7D0'},
          ].map((k,i)=>(
            <div key={i} style={{background:k.bg,border:`1px solid ${k.bd}`,borderRadius:6,padding:'12px',borderLeft:`4px solid ${k.c}`}}>
              <div style={{fontSize:8,fontWeight:700,color:k.c,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:5}}>{k.l}</div>
              <div style={{fontSize:17,fontWeight:800,color:k.c,fontFamily:'monospace'}}>{k.v}</div>
              <div style={{fontSize:9,color:'#6B7280',marginTop:3}}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* TABELA PRINCIPAL */}
        <div style={{border:'1px solid #E4E8F0',borderRadius:6,overflow:'hidden',marginBottom:16}}>
          {/* Cabeçalho */}
          <div style={{display:'grid',gridTemplateColumns:'2.5fr 1fr 0.8fr 1fr',background:'#1D4ED8',padding:'9px 12px',gap:6}}>
            {['Conta / Categoria','Vencimento','Tipo','Valor'].map((h,i)=>(
              <div key={i} style={{fontSize:9,fontWeight:700,color:'#fff',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:i>=2?'right':'left'}}>{h}</div>
            ))}
          </div>

          {/* Separar por grupos */}
          {[
            {label:'⚠ VENCIDAS',color:'#DC2626',bg:'#FFF1F1',items:futureBills.filter((b:any)=>b.live_status==='overdue'&&b.status!=='paid')},
            {label:'📋 A PAGAR',color:'#D97706',bg:'#FFFBEB',items:futureBills.filter((b:any)=>b.status==='pending'&&b.live_status!=='overdue')},
            {label:'✅ PAGAS',color:'#16A34A',bg:'#F0FDF4',items:futureBills.filter((b:any)=>b.status==='paid')},
          ].filter(g=>g.items.length>0).map(g=>(
            <div key={g.label}>
              <div style={{padding:'5px 12px',background:g.bg,fontSize:8,fontWeight:700,color:g.color,textTransform:'uppercase',letterSpacing:'0.5px',borderBottom:'1px solid #E4E8F0',borderTop:'1px solid #E4E8F0'}}>{g.label} ({g.items.length})</div>
              {g.items.map((b:any,i:number)=>(
                <div key={b.id} style={{display:'grid',gridTemplateColumns:'2.5fr 1fr 0.8fr 1fr',padding:'8px 12px',gap:6,background:i%2===0?'#fff':'#FAFAFA',borderBottom:'1px solid #F0F2F7',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:b.status==='paid'?'#9CA3AF':'#111827',textDecoration:b.status==='paid'?'line-through':'none'}}>{b.title}</div>
                    {b.category_name&&<div style={{fontSize:9,color:'#6B7280',marginTop:1}}>{b.category_name}</div>}
                  </div>
                  <div style={{fontSize:10,color:b.live_status==='overdue'&&b.status!=='paid'?'#DC2626':'#374151',fontWeight:b.live_status==='overdue'?700:400}}>{formatDate(b.due_date)}</div>
                  <div style={{fontSize:9,color:'#6B7280',textAlign:'right'}}>{b.recurrence==='monthly'?'Mensal':b.recurrence==='yearly'?'Anual':'Única'}</div>
                  <div style={{fontSize:12,fontWeight:800,color:b.status==='paid'?'#16A34A':b.live_status==='overdue'?'#DC2626':'#111827',fontFamily:'monospace',textAlign:'right'}}>{formatBRL(Number(b.amount))}</div>
                </div>
              ))}
              <div style={{display:'grid',gridTemplateColumns:'2.5fr 1fr 0.8fr 1fr',padding:'6px 12px',gap:6,background:'#F8FAFC',borderBottom:'1px solid #E4E8F0'}}>
                <div style={{fontSize:9,fontWeight:700,color:g.color}}>Subtotal {g.label}</div>
                <div/><div/>
                <div style={{fontSize:11,fontWeight:800,color:g.color,fontFamily:'monospace',textAlign:'right'}}>{formatBRL(g.items.reduce((a:any,b:any)=>a+Number(b.amount),0))}</div>
              </div>
            </div>
          ))}

          {/* Total final */}
          <div style={{display:'grid',gridTemplateColumns:'2.5fr 1fr 0.8fr 1fr',padding:'10px 12px',gap:6,background:'#0F172A',alignItems:'center'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#fff'}}>TOTAL PENDENTE</div>
            <div/><div/>
            <div style={{fontSize:15,fontWeight:800,color:'#FCA5A5',fontFamily:'monospace',textAlign:'right'}}>{formatBRL(futurePend)}</div>
          </div>
        </div>

        {/* RODAPÉ */}
        <div style={{borderTop:'1px solid #E4E8F0',paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
          <div style={{fontSize:8,color:'#9CA3AF'}}>FinanceFlow — Relatório gerado automaticamente</div>
          <div style={{fontSize:8,color:'#9CA3AF'}}>Período: {fMonthLabel} · {today}</div>
        </div>

      </div>
    </div>
  </>)
}
