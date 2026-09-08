import React from 'react';

const card={background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:20,marginBottom:16};
const button={background:'#3949ab',color:'#fff',border:0,borderRadius:8,padding:'12px 18px',cursor:'pointer',fontSize:15};
export default function BusinessPanel({tinode}) {
 const [open,setOpen]=React.useState(false),[data,setData]=React.useState(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);
 const trigger=React.useRef();
 const call=async(method='GET')=>{
  setBusy(true);setError('');
  try {
   const token=tinode.getAuthToken()?.token;
   if(!token)throw Error('请重新登录');
   const headers={Authorization:'Bearer '+token};
   if(method==='POST'){
    const res=await fetch('/api/checkin',{method,headers});const json=await res.json();if(!res.ok)throw Error(json.error);
   }
   const res=await fetch('/api/checkin/status',{headers});const json=await res.json();if(!res.ok)throw Error(json.error);setData(json);
  }catch(e){setError(e.message||'加载失败，请重试')}finally{setBusy(false)}
 };
 const close=()=>{setOpen(false);trigger.current?.focus()};
 React.useEffect(()=>{if(!open)return;const listener=e=>{
 if(e.key==='Escape')close();
 if(e.key==='Tab'){
  const controls=[...document.querySelectorAll('[role="dialog"] button:not([disabled])')];
  const first=controls[0],last=controls[controls.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
 }
};document.addEventListener('keydown',listener);return()=>document.removeEventListener('keydown',listener)},[open]);
 const checked=new Set(data?.records.map(r=>r.date)||[]);
 const month=data?.today.slice(0,7),days=month?new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate():0;
 return <>
  <button ref={trigger} style={{...button,position:'absolute',right:20,bottom:20,zIndex:5}} onClick={()=>{setOpen(true);call()}}>签到与会员</button>
  {open&&<div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(15,23,42,.4)',display:'flex',justifyContent:'center'}}>
   <section role="dialog" aria-modal="true" aria-label="签到与会员" style={{width:'100%',maxWidth:640,background:'#f5f7fb',padding:24,overflowY:'auto',color:'#16233a',boxSizing:'border-box'}}>
    <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}><h2>签到与会员</h2><button autoFocus style={button} onClick={close}>返回聊天</button></header>
    {error&&<div role="alert" style={card}>{error} <button onClick={()=>call()} disabled={busy}>重试</button></div>}
    {!data&&busy&&<p role="status">正在加载…</p>}
    {data&&<>
     <section style={card}><h3>{data.membership.name}</h3><p>{data.membership.expires_at?'有效期至 '+new Date(data.membership.expires_at).toLocaleDateString('zh-CN'):'普通身份，无到期限制'}</p><p>当前签到奖励：{data.membership.reward_units} {data.rule.unit}</p><small>测试积分不代表现金，不支持提现或兑换。</small></section>
     <section style={card}><h3>每日签到</h3><p>{data.today} · {data.rule.timezone}</p><p>累计 {data.total} 天 · 连续 {data.streak} 天</p><button style={{...button,opacity:(busy||data.checkedIn||!data.rule.enabled)?0.8:1}} disabled={busy||data.checkedIn||!data.rule.enabled} onClick={()=>call('POST')}>{busy?'处理中…':data.checkedIn?'今日已签到':data.rule.enabled?'立即签到':'签到暂未开放'}</button></section>
     <section style={card}><h3>{month} 签到日历</h3><div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:6}}>{['一','二','三','四','五','六','日'].map(day=><b key={day} style={{textAlign:'center'}}>{day}</b>)}{Array.from({length:(new Date(month+'-01T00:00:00Z').getUTCDay()+6)%7},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:days},(_,i)=>{const date=month+'-'+String(i+1).padStart(2,'0');return <span key={date} aria-label={date+(checked.has(date)?' 已签到':' 未签到')} style={{textAlign:'center',padding:'10px 0',borderRadius:6,background:checked.has(date)?'#dbeafe':'#f1f5f9'}}>{i+1}{checked.has(date)?' ✓':''}</span>})}</div></section>
     <section style={card}><h3>本月奖励记录</h3>{data.records.length?data.records.map(r=><p key={r.date}>{r.date}　+{r.reward_units} {r.unit}</p>):<p>本月暂无签到记录</p>}</section>
    </>}
   </section>
  </div>}
 </>;
}
