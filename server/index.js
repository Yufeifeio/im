import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from './store.js';
if (process.env.DATABASE_URL) {
 const {startBusiness}=await import('./business.js');
 await startBusiness();
} else {
 if(process.env.ALLOW_LEGACY_DEV !== '1')throw Error('DATABASE_URL required; legacy JSON service is development-only');
const root=path.dirname(fileURLToPath(import.meta.url));
const store=new Store(process.env.DATA_DIR||path.join(root,'../data')); const sessions=new Map();
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'});res.end(JSON.stringify(data));};
const body=req=>new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}})});
const id=()=>crypto.randomUUID(); const auth=req=>{const token=(req.headers.authorization||'').replace(/^Bearer /,'');return sessions.get(token)};
function dateKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:process.env.BUSINESS_TIMEZONE||'Asia/Shanghai'}).format(new Date())}
const routes={
 'POST /api/auth/register':async(req,res)=>{const b=await body(req);if(!b.username||!b.password)return json(res,400,{error:'username and password required'});if(store.state.users.some(u=>u.username===b.username))return json(res,409,{error:'username exists'});const u={id:id(),username:b.username,passwordHash:crypto.createHash('sha256').update(b.password).digest('hex'),createdAt:new Date().toISOString()};store.state.users.push(u);store.save();json(res,201,{id:u.id,username:u.username})},
 'POST /api/auth/login':async(req,res)=>{const b=await body(req);const h=crypto.createHash('sha256').update(b.password||'').digest('hex');const u=store.state.users.find(x=>x.username===b.username&&x.passwordHash===h);if(!u)return json(res,401,{error:'invalid credentials'});const t=id();sessions.set(t,u.id);json(res,200,{token:t,user:{id:u.id,username:u.username}})},
 'GET /api/checkin/status':async(req,res)=>{const uid=auth(req);if(!uid)return json(res,401,{error:'unauthorized'});const list=store.state.checkins.filter(x=>x.userId===uid);json(res,200,{date:dateKey(),checkedIn:list.some(x=>x.date===dateKey()),total:list.length,streak:list.length?1:0,records:list})},
 'POST /api/checkin':async(req,res)=>{const uid=auth(req);if(!uid)return json(res,401,{error:'unauthorized'});const d=dateKey();if(store.state.checkins.some(x=>x.userId===uid&&x.date===d))return json(res,409,{error:'already checked in'});const rec={id:id(),userId:uid,date:d,reward:0,createdAt:new Date().toISOString()};store.state.checkins.push(rec);store.save();json(res,201,rec)},
 'GET /api/products':async(req,res)=>json(res,200,{items:store.state.products.filter(x=>x.active!==false)}),
 'POST /api/orders':async(req,res)=>{const uid=auth(req);if(!uid)return json(res,401,{error:'unauthorized'});const b=await body(req);const p=store.state.products.find(x=>x.id===b.productId);if(!p)return json(res,404,{error:'product not found'});const o={id:id(),userId:uid,productId:p.id,quantity:Number(b.quantity||1),amount:Number(p.price)*Number(b.quantity||1),status:'pending',createdAt:new Date().toISOString()};store.state.orders.push(o);store.save();json(res,201,o)},
 'GET /api/orders':async(req,res)=>{const uid=auth(req);if(!uid)return json(res,401,{error:'unauthorized'});json(res,200,{items:store.state.orders.filter(x=>x.userId===uid)})},
 'POST /api/meetings':async(req,res)=>{const uid=auth(req);if(!uid)return json(res,401,{error:'unauthorized'});const b=await body(req);const m={id:id(),title:b.title||'会议',groupId:b.groupId||null,creatorId:uid,status:'active',startedAt:new Date().toISOString(),participants:[]};store.state.meetings.push(m);store.save();json(res,201,m)},
 'GET /api/meetings':async(req,res)=>{const uid=auth(req);if(!uid)return json(res,401,{error:'unauthorized'});json(res,200,{items:store.state.meetings.filter(x=>x.creatorId===uid||x.participants.includes(uid))})},
 'POST /api/meetings/join':async(req,res)=>{const uid=auth(req);if(!uid)return json(res,401,{error:'unauthorized'});const b=await body(req);const m=store.state.meetings.find(x=>x.id===b.meetingId&&x.status==='active');if(!m)return json(res,404,{error:'meeting unavailable'});if(!m.participants.includes(uid))m.participants.push(uid);store.save();json(res,200,{meetingId:m.id,participantCount:m.participants.length})}
};
const server=http.createServer(async(req,res)=>{try{if(req.method==='OPTIONS')return json(res,204,{});const key=req.method+' '+req.url.split('?')[0];if(routes[key])return await routes[key](req,res);if(req.method==='GET'&&(req.url==='/'||req.url==='/index.html')){res.writeHead(200,{'content-type':'text/html'});return res.end(fs.readFileSync(path.join(root,'../web/index.html')))}json(res,404,{error:'not found'})}catch(e){json(res,500,{error:'internal error'})}});
const port=Number(process.env.PORT||8080);server.listen(port,()=>console.log(`IM API listening on http://127.0.0.1:${port}`));

}
