import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const key=readFileSync('.runtime/client-key','utf8').trim();
async function connect() {
 const ws=new WebSocket((process.env.CHAT_WS||'ws://127.0.0.1:6060/v0/channels')+'?apikey='+key);
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let seq=0; const pending=new Map(); const data=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.data)data.push(m.data);if(m.ctrl&&pending.has(m.ctrl.id)){pending.get(m.ctrl.id)(m.ctrl);pending.delete(m.ctrl.id)}};
 const send=(type,payload)=>new Promise((r,j)=>{const id=String(++seq);const timer=setTimeout(()=>{pending.delete(id);j(Error('timeout '+type))},10000);pending.set(id,c=>{clearTimeout(timer);c.code>=400?j(Error(JSON.stringify(c))):r(c)});ws.send(JSON.stringify({[type]:{...payload,id}}))});
 await send('hi',{ver:'0.25',ua:'IM integration test'});
 return {ws,send,data};
}
const a=await connect(), b=await connect();
try {
 const suffix=randomBytes(6).toString('hex');
 for (const [c,n] of [[a,'a'],[b,'b']]) {
  const r=await c.send('acc',{user:'new',scheme:'basic',secret:Buffer.from('test'+n+suffix+':'+randomBytes(16).toString('hex')).toString('base64'),login:true,desc:{public:{fn:'Integration '+n}}});
  c.uid=r.params.user; c.token=r.params.token;
 }
 const g=await a.send('sub',{topic:'new',set:{desc:{public:{fn:'Integration group'}}}});
 const topic=g.topic;
 await a.send('set',{topic,sub:{user:b.uid,mode:'JRWPS'}});
 await b.send('sub',{topic});
 await a.send('pub',{topic,content:'persistent message '+suffix});
 await new Promise(r=>setTimeout(r,300));
 assert(b.data.some(d=>d.content==='persistent message '+suffix));
 await b.send('leave',{topic});
 await b.send('sub',{topic,get:{what:'data',data:{limit:10}}});
 await new Promise(r=>setTimeout(r,300));
 assert(b.data.filter(d=>d.content==='persistent message '+suffix).length>=2);
 const c=await connect();
 try { await c.send('login',{scheme:'token',secret:a.token}); } finally {c.ws.close()}
 console.log('PASS: real registration, group membership, delivery, history reload and token login');
 await a.send('del',{what:'topic',topic,hard:true});
 await b.send('del',{what:'user',hard:true});
 await a.send('del',{what:'user',hard:true});
} finally {a.ws.close();b.ws.close()}
