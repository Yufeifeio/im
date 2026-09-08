import http from 'node:http';
import {readFileSync} from 'node:fs';
import pg from 'pg';

export const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
const appKey=process.env.TINODE_PUBLIC_APP_KEY;
const endpoint=process.env.TINODE_WS || 'ws://127.0.0.1:6060/v0/channels';
const failure=(status,message)=>Object.assign(new Error(message),{status});
export async function migrate() {
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(4821831)");
  await client.query(readFileSync(new URL('./migrations/001-business.sql',import.meta.url),'utf8'));
  await client.query('COMMIT');
 } catch(e) {await client.query('ROLLBACK');throw e}
 finally {client.release()}
}
// Delegate identity validation to the official service, including revocation and account state.
export function verifyIdentity(token) {
 if(!token || token.length>2048) return Promise.reject(failure(401,'请先登录'));
 return new Promise((resolve,reject)=>{
  const socket=new WebSocket(endpoint+'?apikey='+encodeURIComponent(appKey));
  const timer=setTimeout(()=>finish(failure(503,'登录服务暂不可用')),5000);
  let finished=false;
  function finish(error,uid){if(finished)return;finished=true;clearTimeout(timer);socket.close();error?reject(error):resolve(uid)}
  socket.onopen=()=>socket.send(JSON.stringify({hi:{id:'hi',ver:'0.25',ua:'IM Business'}}));
  socket.onerror=()=>finish(failure(503,'登录服务暂不可用'));
  socket.onclose=()=>{if(!finished)finish(failure(503,'登录连接已中断'))};
  socket.onmessage=event=>{
   const ctrl=JSON.parse(event.data).ctrl;if(!ctrl)return;
   if(ctrl.code>=400)return finish(failure(401,'登录已失效，请重新登录'));
   if(ctrl.id==='hi')socket.send(JSON.stringify({login:{id:'login',scheme:'token',secret:token}}));
   if(ctrl.id==='login')ctrl.params?.user?finish(null,ctrl.params.user):finish(failure(401,'身份验证失败'));
  };
 });
}
async function membership(client,user) {
 const {rows}=await client.query(`SELECT l.code,l.name,l.reward_units,m.starts_at,m.expires_at
 FROM membership_levels l LEFT JOIN memberships m ON m.user_id=$1
 WHERE l.code=COALESCE((SELECT level_code FROM memberships WHERE user_id=$1
 AND enabled AND starts_at<=now() AND expires_at>now()),'ordinary')`,[user]);
 const current=rows[0];
 return {...current,expires_at:current.code==='ordinary'?null:current.expires_at,status:current.code==='ordinary'?'ordinary':'active'};
}
export async function checkin(client,user) {
 await client.query('BEGIN');
 try {
  // Serialize this user's award transaction across workers, not across all users.
  await client.query('SELECT id FROM business_users WHERE id=$1 FOR UPDATE',[user]);
  const {rows:[rule]}=await client.query('SELECT *, (now() AT TIME ZONE timezone)::date::text AS today FROM checkin_rules WHERE id=1 FOR SHARE');
  if(!rule.enabled)throw failure(409,'签到暂未开放');
  const level=await membership(client,user);
  const snapshot={revision:rule.revision,timezone:rule.timezone,unit:rule.unit,level:level.code,reward:level.reward_units};
  const result=await client.query(`INSERT INTO checkins(user_id,business_date,reward_units,level_code,rule_snapshot)
  VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,business_date) DO NOTHING RETURNING *`,
  [user,rule.today,level.reward_units,level.code,snapshot]);
  const rec=result.rows[0];
  await client.query('INSERT INTO business_audit(actor,action,details) VALUES($1,$2,$3)',[user,rec?'checkin':'checkin_duplicate',{date:rule.today}]);
  if(rec)await client.query('INSERT INTO reward_ledger(user_id,checkin_id,amount,unit) VALUES($1,$2,$3,$4)',[user,rec.id,rec.reward_units,rule.unit]);
  await client.query('COMMIT');
  return {alreadyCheckedIn:!rec,date:rule.today,reward:rec?rec.reward_units:'0',unit:rule.unit};
 } catch(e){await client.query('ROLLBACK');throw e}
}
async function summary(client,user) {
 const {rows:[rule]}=await client.query('SELECT *, (now() AT TIME ZONE timezone)::date::text AS today FROM checkin_rules WHERE id=1');
 const {rows}=await client.query(`SELECT business_date::text AS date,reward_units,rule_snapshot->>'unit' AS unit
 FROM checkins WHERE user_id=$1 AND business_date>=date_trunc('month',$2::date) AND business_date<date_trunc('month',$2::date)+interval '1 month' ORDER BY business_date`,[user,rule.today]);
 const {rows:[count]}=await client.query('SELECT count(*)::int AS total FROM checkins WHERE user_id=$1',[user]);
 const {rows:recent}=await client.query(`SELECT business_date::text AS date FROM checkins WHERE user_id=$1 AND business_date<=$2 ORDER BY business_date DESC`,[user,rule.today]);
 let cursor=Date.parse(rule.today),streak=0;
 if(recent[0]?.date!==rule.today)cursor-=86400000;
 for(const rec of recent){if(Date.parse(rec.date)!==cursor)break;streak++;cursor-=86400000}
 return {today:rule.today,checkedIn:rows.some(r=>r.date===rule.today),total:count.total,streak,records:rows,rule,membership:await membership(client,user)};
}
function respond(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>65536)reject(failure(413,'请求过大'))});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{reject(failure(400,'请求格式错误'))}});req.on('error',reject)})}
export async function startBusiness() {
 if(!appKey)throw Error('TINODE_PUBLIC_APP_KEY is required');
 await migrate();
 const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  try {
   if(path==='/api/health' && req.method==='GET'){await pool.query('SELECT 1');return respond(res,200,{status:'ok'})}
   if(path==='/api/products'&&req.method==='GET'){return respond(res,200,{items:(await pool.query('SELECT * FROM products WHERE active ORDER BY id')).rows})}
   if(path.startsWith('/api/products/')&&req.method==='GET'){const id=path.split('/').pop();const row=(await pool.query('SELECT * FROM products WHERE id=$1 AND active',[id])).rows[0];return row?respond(res,200,row):respond(res,404,{error:'商品不存在'})}
   if(!['GET /api/checkin/status','POST /api/checkin','GET /api/membership','GET /api/products','POST /api/orders','GET /api/orders'].includes(req.method+' '+path) && !(req.method==='GET'&&path.startsWith('/api/products/')))return respond(res,404,{error:'接口尚未开放'});
   const uid=await verifyIdentity((req.headers.authorization||'').replace(/^Bearer /,''));
   const {rows:[user]}=await pool.query(`INSERT INTO business_users(tinode_uid) VALUES($1)
   ON CONFLICT(tinode_uid) DO UPDATE SET tinode_uid=excluded.tinode_uid RETURNING id`,[uid]);
   const client=await pool.connect();
   try {
    let data;
    if(path==='/api/checkin/status') data=await summary(client,user.id); else if(path==='/api/membership') data=await membership(client,user.id); else if(path==='/api/products') data={items:(await client.query('SELECT * FROM products WHERE active ORDER BY id')).rows}; else if(path==='/api/orders'&&req.method==='GET') data={items:(await client.query('SELECT o.*,p.name FROM orders o JOIN products p ON p.id=o.product_id WHERE o.user_id=$1 ORDER BY o.created_at DESC',[user.id])).rows}; else if(path==='/api/orders'){const b=await readBody(req); await client.query('BEGIN'); const p=(await client.query('SELECT * FROM products WHERE id=$1 AND active FOR UPDATE',[b.productId])).rows[0]; if(!p||p.stock<1) throw failure(409,'商品库存不足'); const o=(await client.query('INSERT INTO orders(user_id,product_id,amount) VALUES($1,$2,$3) RETURNING *',[user.id,p.id,p.price])).rows[0]; await client.query('UPDATE products SET stock=stock-1 WHERE id=$1',[p.id]); await client.query('COMMIT'); data=o;} else data=await checkin(client,user.id);
    respond(res,200,data);
   } finally {client.release()}
  } catch(e) {if(!e.status)console.error('Business request failed:',e.code||e.name);respond(res,e.status||500,{error:e.status?e.message:'服务暂时异常，请稍后重试'})}
 });
 server.listen(Number(process.env.PORT||8080),'127.0.0.1');
 return server;
}
