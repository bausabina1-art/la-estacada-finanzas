import {timingSafeEqual, createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest();
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const send=(s,d)=>res.status(s).json(d);
 const {APP_PASSWORD,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN}=process.env;
 if(!APP_PASSWORD||!UPSTASH_REDIS_REST_URL||!UPSTASH_REDIS_REST_TOKEN)return send(503,{error:'Falta configurar contraseña y base de datos.'});
 const expected='bautista:'+APP_PASSWORD;const basic=req.headers.authorization||'';
 const supplied=basic.startsWith('Basic ')?Buffer.from(basic.slice(6),'base64').toString():'';
 if(!timingSafeEqual(hash(supplied),hash(expected))){res.setHeader('WWW-Authenticate','Basic realm="La Estacada", charset="UTF-8"');return send(401,{error:'Ingresá con tu usuario y contraseña.'});}
 if(req.method!=='GET'&&req.headers.origin!==`https://${req.headers.host}`&&req.headers.origin!==`http://${req.headers.host}`)return send(403,{error:'Origen no permitido'});
 const redis=async command=>{const r=await fetch(UPSTASH_REDIS_REST_URL,{method:'POST',headers:{Authorization:'Bearer '+UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(command)});const j=await r.json();if(!r.ok||j.error)throw Error('Database failure');return j.result;};
 const id=req.query.id;const key='estacada:finance:records';
 try{
 if(req.method==='GET'){const result=await redis(['HVALS',key]);return send(200,result.map(x=>JSON.parse(x)));}
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))return send(400,{error:'ID inválido'});
 if(req.method==='DELETE'){await redis(['HDEL',key,id]);return send(200,{ok:true});}
 if(req.method==='PUT'){
 const r=typeof req.body==='string'?JSON.parse(req.body):req.body;
 if(!r||!['polo','personal'].includes(r.account)||!['income','expense','transfer'].includes(r.type)||!['ARS','USD'].includes(r.currency)||typeof r.amount!=='number'||!Number.isFinite(r.amount)||r.amount<=0||typeof r.rate!=='number'||!Number.isFinite(r.rate)||r.rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||typeof r.description!=='string'||!r.description.trim()||r.description.length>300||typeof r.category!=='string'||!r.category.trim()||r.category.length>100)return send(400,{error:'Datos inválidos'});
 const record={id,account:r.account,type:r.type,currency:r.currency,amount:r.amount,rate:r.rate,date:r.date,description:r.description.trim(),category:r.category.trim()};
 await redis(['HSET',key,id,JSON.stringify(record)]);return send(200,{ok:true});}
 return send(405,{error:'Método no permitido'});
 }catch{return send(500,{error:'No se pudo completar la operación.'});}
}
