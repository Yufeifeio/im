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
  c.username='test'+n+suffix; c.password=randomBytes(16).toString('hex');
  const r=await c.send('acc',{user:'new',scheme:'basic',secret:Buffer.from(c.username+':'+c.password).toString('base64'),login:true,desc:{public:{fn:'Integration '+n}}});
  c.uid=r.params.user; c.token=r.params.token;
 }
 // Verify private messages and a second device using the same identity.
 await a.send('sub',{topic:b.uid});
 await b.send('sub',{topic:a.uid});
 const multi=await connect();
 try {
  await multi.send('login',{scheme:'token',secret:b.token});
  await multi.send('sub',{topic:a.uid});
  await a.send('pub',{topic:b.uid,content:'private '+suffix});
  await new Promise(r=>setTimeout(r,300));
  assert(b.data.some(d=>d.content==='private '+suffix));
  assert(multi.data.some(d=>d.content==='private '+suffix));
 } finally {multi.ws.close()}
 // Disconnected recipient must receive history on a fresh authenticated connection.
 await b.send('leave',{topic:a.uid});
 b.ws.close();
 await a.send('pub',{topic:b.uid,content:'offline '+suffix});
 const recovered=await connect();
 await recovered.send('login',{scheme:'token',secret:b.token});
 recovered.uid=b.uid; recovered.token=b.token;
 Object.assign(b,recovered);
 await b.send('sub',{topic:a.uid,get:{what:'data',data:{limit:10}}});
 await new Promise(r=>setTimeout(r,300));
 assert(b.data.some(d=>d.content==='offline '+suffix));
 // Actual multipart upload and authenticated download, not a mock URL.
 const http=(process.env.CHAT_WS||'ws://127.0.0.1:6060/v0/channels').replace(/^ws/,'http').replace('/v0/channels','');
 const headers={'X-Tinode-APIKey':key,Authorization:'Token '+a.token,Origin:'https://im.cyfljj.com'};
 const form=new FormData();
 const contents='IM file '+suffix;
 form.append('file',new Blob([contents],{type:'text/plain'}),'integration.txt');
 const uploaded=await fetch(http+'/v0/file/u/',{method:'POST',headers,body:form});
 assert.equal(uploaded.status,200,await uploaded.clone().text());
 if (process.env.CHAT_WS) assert.equal(uploaded.headers.get('access-control-allow-origin'),'https://im.cyfljj.com');
 const upload=await uploaded.json();
 const url=upload.ctrl.params.url;
 const downloaded=await fetch(new URL(url,http),{headers});
 assert.equal(downloaded.status,200);
 assert.equal(await downloaded.text(),contents);
 const denied=await fetch(new URL(url,http),{headers:{'X-Tinode-APIKey':key}});
 assert.equal(denied.status,401);
 await a.send('pub',{topic:b.uid,content:'file '+url,extra:{attachments:[url]}});
 const g=await a.send('sub',{topic:'new',set:{desc:{public:{fn:'Integration group'}}}});
 const topic=g.topic;
 await a.send('set',{topic,sub:{user:b.uid,mode:'JRWPS'}});
 await b.send('sub',{topic});
 // Ordinary member must not promote itself to owner.
 await assert.rejects(b.send('set',{topic,sub:{user:b.uid,mode:'JRWPSAO'}}), /403/);
 await a.send('pub',{topic,content:'persistent message '+suffix});
 await new Promise(r=>setTimeout(r,300));
 assert(b.data.some(d=>d.content==='persistent message '+suffix));
 await b.send('leave',{topic});
 await b.send('sub',{topic,get:{what:'data',data:{limit:10}}});
 await new Promise(r=>setTimeout(r,300));
 assert(b.data.filter(d=>d.content==='persistent message '+suffix).length>=2);
 const c=await connect();
 try { await c.send('login',{scheme:'token',secret:a.token}); } finally {c.ws.close()}
 if (process.env.BUSINESS_TEST === '1') {
  const api=process.env.BUSINESS_URL||'http://127.0.0.1:8080';
  const headers={Authorization:'Bearer '+a.token};
  assert.equal((await fetch(api+'/api/checkin/status')).status,401);
  const responses=await Promise.all(Array.from({length:20},()=>fetch(api+'/api/checkin',{method:'POST',headers}).then(async r=>{assert.equal(r.status,200);return r.json()})));
  assert.equal(responses.filter(r=>!r.alreadyCheckedIn).length,1);
  const status=await fetch(api+'/api/checkin/status',{headers}).then(r=>r.json());
  assert.equal(status.total,1);assert.equal(status.streak,1);assert.equal(status.records.length,1);
  assert.equal(status.membership.code,'ordinary');
  const other=await fetch(api+'/api/checkin/status',{headers:{Authorization:'Bearer '+b.token}}).then(r=>r.json());
  assert.equal(other.total,0);
  if(process.env.DATABASE_URL){
   const {default:pg}=await import('pg');const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
   const code='test-'+suffix;
   try {
    const {rows:[user]}=await db.query('SELECT id FROM business_users WHERE tinode_uid=$1',[a.uid]);
    const {rows:[ledger]}=await db.query('SELECT count(*)::int AS count FROM reward_ledger WHERE user_id=$1',[user.id]);
    assert.equal(ledger.count,1);
    await db.query('INSERT INTO membership_levels VALUES($1,$2,100)',[code,'测试会员']);
    await db.query("INSERT INTO memberships VALUES($1,$2,now()-interval '1 day',now()+interval '1 day',true)",[user.id,code]);
    let member=await fetch(api+'/api/membership',{headers}).then(r=>r.json());assert.equal(member.code,code);
    await db.query("UPDATE memberships SET expires_at=now()-interval '1 second' WHERE user_id=$1",[user.id]);
    member=await fetch(api+'/api/membership',{headers}).then(r=>r.json());assert.equal(member.code,'ordinary');
    const {rows:[reward]}=await db.query('SELECT reward_units,level_code FROM checkins WHERE user_id=$1',[user.id]);
    assert.equal(reward.reward_units,'10');assert.equal(reward.level_code,'ordinary');
    console.log('PASS: exactly one reward ledger, membership activation/expiry and immutable reward snapshot');
   } finally {
    await db.query('DELETE FROM memberships WHERE level_code=$1',[code]);await db.query('DELETE FROM membership_levels WHERE code=$1',[code]);await db.end();
   }
  }
  console.log('PASS: shared identity, unauthorized rejection, 20 concurrent check-ins award once, user isolation');
 }
 if (process.env.BROWSER_TEST === '1') {
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  try {
   const page=await browser.newPage({locale:'en-US'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('https://im.cyfljj.com',{waitUntil:'domcontentloaded'});
   assert(!/tinode|github\.com/i.test(await page.locator('body').innerText()));
   assert.equal(await page.title(),'IM');
   assert.equal(await page.locator('a[href*="github.com"]').count(),0);
   await page.getByPlaceholder('Login',{exact:true}).fill(a.username);
   await page.getByPlaceholder('Password',{exact:true}).fill(a.password);
   await page.locator('#login-form button[type=submit]').click();
   await page.getByPlaceholder('Login',{exact:true}).waitFor({state:'hidden',timeout:15000});
   assert(!/tinode|github\.com/i.test(await page.locator('body').innerText()));
   assert.deepEqual(errors,[]);
   console.log('PASS: Chromium real user login');
   if(process.env.BUSINESS_TEST==='1'){
    await page.getByRole('button',{name:'签到与会员',exact:true}).click();
    await page.getByRole('heading',{name:'每日签到',exact:true}).waitFor();
    await page.getByRole('button',{name:'今日已签到',exact:true}).waitFor();
    await page.getByRole('button',{name:'返回聊天',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
    console.log('PASS: signed-in business panel, persisted check-in and return to chat');
   }
  } finally {await browser.close()}
 }
 console.log('PASS: registration, private chat, two-device delivery, group permissions, authenticated file upload/download, history reload and token login');
 await a.send('del',{what:'topic',topic,hard:true});
} finally {
 if(process.env.DATABASE_URL && process.env.BUSINESS_TEST==='1'){
  const {default:pg}=await import('pg');const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
  try {
   await db.query('BEGIN');
   const {rows}=await db.query('SELECT id FROM business_users WHERE tinode_uid=ANY($1)',[[a.uid,b.uid]]);
   for(const {id} of rows){
    await db.query('DELETE FROM reward_ledger WHERE user_id=$1',[id]);
    await db.query('DELETE FROM checkins WHERE user_id=$1',[id]);
    await db.query('DELETE FROM business_audit WHERE actor=$1',[id]);
    await db.query('DELETE FROM memberships WHERE user_id=$1',[id]);
    await db.query('DELETE FROM business_users WHERE id=$1',[id]);
   }
   await db.query('COMMIT');
  } catch(e){await db.query('ROLLBACK');throw e}finally{await db.end()}
 }
 // Only delete accounts created by this test, including assertion failure paths.
 for (const c of [b,a]) {
  if (c.uid && c.ws.readyState === WebSocket.OPEN) {
   try {await c.send('del',{what:'user',hard:true})}
   catch (e) {console.error('Test account cleanup failed:',c.uid,e.message)}
  }
  c.ws.close();
 }
}
