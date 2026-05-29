import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VERIFY_TOKEN = "financeflow2025";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type" };

const RULES: Array<{k: string[], c: string}> = [
  {k:["gasolina","posto","combustivel","shell","ipiranga"],c:"Transporte"},
  {k:["uber","99","taxi","onibus","metro","passagem"],c:"Transporte"},
  {k:["mercado","supermercado","carrefour","extra","assai"],c:"Mercado"},
  {k:["ifood","rappi","restaurante","lanche","pizza","comida"],c:"Alimentacao"},
  {k:["luz","energia","cemig","copel","enel","cpfl"],c:"Contas Fixas"},
  {k:["agua","saneamento","sabesp","cedae"],c:"Contas Fixas"},
  {k:["internet","wifi","vivo","claro","tim","net"],c:"Assinaturas"},
  {k:["netflix","spotify","disney","hbo","amazon prime"],c:"Assinaturas"},
  {k:["farmacia","drogaria","remedio","medicamento"],c:"Saude"},
  {k:["medico","consulta","clinica","hospital","dentista"],c:"Saude"},
  {k:["aluguel","condominio","iptu"],c:"Moradia"},
  {k:["escola","faculdade","curso","mensalidade"],c:"Educacao"},
  {k:["salario","contracheque"],c:"Salario"},
  {k:["freelance","freela"],c:"Freelance"},
  {k:["cartao","fatura","nubank","itau","bradesco"],c:"Cartao Credito"},
  {k:["emprestimo","divida","parcela"],c:"Dividas"},
];

function qc(t: string): string {
  const l = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  for (const r of RULES) if (r.k.some(k=>l.includes(k))) return r.c;
  return "Outros";
}
function fmt(v: number) { return "R$ "+v.toLocaleString("pt-BR",{minimumFractionDigits:2}); }

async function getAK(sb: ReturnType<typeof createClient>) {
  const {data} = await sb.from("app_config").select("value").eq("key","ANTHROPIC_API_KEY").single();
  return data?.value ?? "";
}

async function parseMsg(msg: string, ak: string): Promise<Record<string,unknown>> {
  const today = new Date().toISOString().split("T")[0];
  const m = msg.match(/^(?:paguei\s+|recebi\s+|entrada\s+)?([\d.,]+)\s+(.+?)(?:\s+vence\s+(?:dia\s+)?(\d{1,2}))?$/i);
  if (m) {
    const pre = (msg.match(/^(paguei|recebi|entrada)/i)?.[1]??"").toLowerCase();
    const amt = parseFloat(m[1].replace(/\./g,"").replace(",","."));
    const desc = m[2].trim();
    const dd = m[3]?parseInt(m[3]):null;
    const inc = ["recebi","entrada"].includes(pre);
    const bill = dd!==null||/vence/i.test(msg);
    return {type:bill?"bill":inc?"income":"expense",amount:isNaN(amt)?0:amt,description:desc,category:qc(desc),date:bill?null:today,due_day:dd,status:bill?"pending":inc?"received":"paid",confidence:0.9};
  }
  if (!ak) return {type:"unknown",confidence:0};
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":ak,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:200,messages:[{role:"user",content:'Parse financeiro BR. Data:'+today+'. Msg:"'+msg+'". JSON:{"type":"expense|income|bill|unknown","amount":number,"description":string,"category":string,"date":"YYYY-MM-DD|null","due_day":number|null,"status":string}'}]})
    });
    const d = await r.json();
    return JSON.parse((d.content?.[0]?.text??"{}").replace(/```[\w]*/g,"").trim());
  } catch { return {type:"unknown",confidence:0}; }
}

async function sendWA(phone: string, msg: string, s: Record<string,unknown>) {
  const key = s.whatsapp_api_key as string;
  if (!key) return;
  try {
    if (s.whatsapp_provider==="meta") {
      const pid = s.meta_phone_number_id as string ?? "";
      if (!pid) return;
      await fetch(`https://graph.facebook.com/v19.0/${pid}/messages`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
        body:JSON.stringify({messaging_product:"whatsapp",to:phone,type:"text",text:{body:msg}})
      });
    } else if (s.whatsapp_provider==="waha"&&s.waha_url) {
      await fetch(s.waha_url+"/api/sendText",{method:"POST",headers:{"Content-Type":"application/json","X-Api-Key":key},body:JSON.stringify({chatId:phone+"@c.us",text:msg,session:"default"})});
    } else if (s.whatsapp_provider==="evolution"&&s.evolution_url) {
      await fetch(s.evolution_url+"/message/sendText/"+s.whatsapp_phone,{method:"POST",headers:{"Content-Type":"application/json","apikey":key},body:JSON.stringify({number:phone,text:msg})});
    }
  } catch(e){console.error("[send]",e);}
}

Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{headers:CORS});

  // Meta webhook verification (GET)
  if (req.method==="GET") {
    const u = new URL(req.url);
    const mode = u.searchParams.get("hub.mode");
    const token = u.searchParams.get("hub.verify_token");
    const challenge = u.searchParams.get("hub.challenge");
    if (mode==="subscribe"&&token===VERIFY_TOKEN&&challenge) {
      console.log("[webhook] Meta OK");
      return new Response(challenge,{status:200,headers:{"Content-Type":"text/plain"}});
    }
    return new Response("Forbidden",{status:403});
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json();
    let phone="",text="";

    // Meta Cloud API
    if (body.object==="whatsapp_business_account") {
      const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!msg||msg.type!=="text") return new Response('{"ok":true}',{headers:CORS});
      phone = msg.from; text = msg.text?.body??"";
    }
    // Evolution
    else if (body.data?.key?.remoteJid) {
      if (body.data?.key?.fromMe) return new Response('{"ok":true}',{headers:CORS});
      phone = body.data.key.remoteJid.replace("@s.whatsapp.net","");
      text = body.data.message?.conversation??body.data.message?.extendedTextMessage?.text??"";
    }
    // Waha
    else if (body.payload?.from&&body.payload?.body) { phone=body.payload.from.replace("@c.us",""); text=body.payload.body; }
    // Generic
    else if (body.phone&&body.message) { phone=body.phone; text=body.message; }

    if (!phone||!text.trim()) return new Response('{"ok":true}',{headers:CORS});

    const cp = phone.replace(/\D/g,"");
    const {data:rows} = await sb.from("user_settings").select("*")
      .or(`whatsapp_phone.eq.${cp},whatsapp_phone.eq.+${cp},whatsapp_phone.eq.55${cp},whatsapp_phone.eq.+55${cp}`);

    if (!rows?.length) return new Response('{"ok":true,"note":"not_found"}',{headers:CORS});
    const st=rows[0]; const uid=st.user_id;
    const lw=text.toLowerCase().trim();

    if (["resumo","saldo","r"].includes(lw)) {
      const {data:s} = await sb.rpc("get_dashboard_summary",{p_user_id:uid});
      const d=s??{};
      await sendWA(phone,"📊 *Resumo do Mês*\n\n💸 Despesas: "+fmt(d.total_expense??0)+"\n✅ Receitas: "+fmt(d.total_income??0)+"\n📋 Pendentes: "+fmt(d.bills_pending??0)+"\n⚠️ Vencidas: "+fmt(d.bills_overdue??0)+"\n💰 Saldo: "+fmt((d.total_income??0)-(d.total_expense??0)),st);
      return new Response('{"ok":true}',{headers:CORS});
    }
    if (["ajuda","help","?","oi","ola"].includes(lw)) {
      await sendWA(phone,"🤖 *FinanceFlow Bot*\n\n💸 _50 gasolina_\n💸 _paguei 80 mercado_\n✅ _recebi 3000 salário_\n📋 _luz 180 vence dia 10_\n📊 _resumo_",st);
      return new Response('{"ok":true}',{headers:CORS});
    }

    const ak = await getAK(sb);
    const p = await parseMsg(text,ak);

    if (p.type==="unknown"||!p.amount||(p.amount as number)<=0) {
      await sendWA(phone,"❓ Não entendi. Tente: _50 gasolina_\nDigite *ajuda* para exemplos.",st);
      await sb.from("whatsapp_messages").insert({user_id:uid,phone:cp,raw_message:text,status:"failed",parsed_type:"unknown"});
      return new Response('{"ok":true}',{headers:CORS});
    }

    const {data:cat} = await sb.from("categories").select("id").or(`user_id.eq.${uid},user_id.is.null`).ilike("name",p.category as string).limit(1).maybeSingle();
    const cid=cat?.id??null;
    let tid=null,bid=null,reply="";

    if (p.type==="bill") {
      const now=new Date();
      const dd=new Date(now.getFullYear(),now.getMonth(),(p.due_day as number)||10);
      if (dd<=now) dd.setMonth(dd.getMonth()+1);
      const {data:bill} = await sb.from("bills").insert({user_id:uid,category_id:cid,title:p.description,amount:p.amount,due_date:dd.toISOString().split("T")[0],status:"pending",recurrence:"once",payment_method:"pix"}).select().single();
      bid=bill?.id;
      reply="📋 *Conta registrada!*\n\n📌 "+p.description+"\n💵 "+fmt(p.amount as number)+"\n📅 Vence "+dd.toLocaleDateString("pt-BR")+"\n🏷️ "+p.category;
    } else {
      const {data:tx} = await sb.from("transactions").insert({user_id:uid,category_id:cid,title:p.description,amount:p.amount,type:p.type,status:"confirmed",payment_method:"pix",transaction_date:(p.date as string)??new Date().toISOString().split("T")[0],source:"whatsapp"}).select().single();
      tid=tx?.id;
      reply=(p.type==="income"?"✅":"💸")+" *"+(p.type==="income"?"Receita":"Despesa")+" registrada!*\n\n📌 "+p.description+"\n💵 "+fmt(p.amount as number)+"\n🏷️ "+p.category+"\n📅 "+new Date().toLocaleDateString("pt-BR");
    }

    await sb.from("whatsapp_messages").insert({user_id:uid,phone:cp,raw_message:text,parsed_amount:p.amount,parsed_description:p.description as string,parsed_category:p.category as string,parsed_type:p.type as string,parsed_date:(p.date as string)??null,parsed_due_day:(p.due_day as number)??null,status:"processed",transaction_id:tid,bill_id:bid});
    await sendWA(phone,reply,st);
    return new Response(JSON.stringify({ok:true,parsed:p}),{headers:{...CORS,"Content-Type":"application/json"}});

  } catch(e) {
    console.error("[wh]",e);
    return new Response('{"error":"internal"}',{status:500,headers:CORS});
  }
});
