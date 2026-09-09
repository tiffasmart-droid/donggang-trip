const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../core.js');
const {createStore}=require('../store.js');
const row=(id,amount=100)=>({id,room_code:'0912',title:'午餐',amount,payer:0,participants:[0,1,2,3,4],category:'餐飲',created_at:'2026-09-12T04:00:00Z'});
function optimalCount(net){
  const a=net.filter(Boolean),n=a.length;
  if(!n)return 0;
  const dp=Array(1<<n).fill(-Infinity);dp[0]=0;
  for(let mask=1;mask<(1<<n);mask++) {
    for(let sub=mask;sub;sub=(sub-1)&mask){
      let sum=0;for(let i=0;i<n;i++)if(sub&(1<<i))sum+=a[i];
      if(sum===0)dp[mask]=Math.max(dp[mask],dp[mask^sub]+1);
    }
  }
  return n-dp.at(-1);
}
function checkNet(net){
  const tx=core.minimumTransfers(net),after=net.slice();
  tx.forEach(t=>{assert(t.amt>0);const n=Math.round(t.amt*100);after[t.from]+=n;after[t.to]-=n});
  assert(after.every(n=>n===0));assert.equal(tx.length,optimalCount(net));
}
const split=core.calculate([row('a',100)]);
assert.deepEqual(split.net,[80,-20,-20,-20,-20]);assert.equal(split.tx.length,4);assert.deepEqual(split.paid,[100,0,0,0,0]);assert.deepEqual(split.shares,[20,20,20,20,20]);
assert.deepEqual(core.calculate([row('a',0.01)]).net,[0,0,0,0,0]);
assert.equal(core.calculate([row('a',100.01)]).net.reduce((a,b)=>Math.round((a+b)*100)/100,0),0);
for(const value of [0,-1,Infinity,NaN,'1.001','1e3','100000001'])assert.throws(()=>core.cents(value));
for(const patch of [{payer:5},{payer:0.5},{participants:[]},{participants:[0,0]},{participants:[-1]},{title:''}])assert.throws(()=>core.validate({...row('a'),...patch}));
checkNet([-500,-1000,1000,500,0]);
for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++)for(let c=-3;c<=3;c++)for(let d=-3;d<=3;d++)checkNet([a,b,c,d,-a-b-c-d]);
console.log('PASS: 2,401 balances match independent minimum-transfer partition oracle; rounding and validation');

function mock(){
  const state={rows:[row('a')],calls:[],handlers:[],status:null,fail:false,removed:false,slow:null};
  const channel={on(kind,filter,cb){state.handlers.push({filter,cb});return this},subscribe(cb){state.status=cb;return this}};
  const client={channel(){return channel},removeChannel(){state.removed=true;return Promise.resolve()},from(table){
    const call={table,op:'read',filters:[],range:[0,499]};state.calls.push(call);
    const q={select(){return q},eq(k,v){call.filters.push([k,v]);return q},order(){return q},range(a,b){call.range=[a,b];return q},single(){call.single=true;return q},insert(value){call.op='insert';call.value=value;return q},delete(){call.op='delete';return q},then(resolve,reject){return (async()=>{
      if(state.slow){const gate=state.slow;state.slow=null;await gate}
      if(state.fail)return {data:null,error:Error('denied')};
      if(call.op==='insert'){state.rows.push(call.value);return {data:{id:call.value.id},error:null}}
      if(call.op==='delete'){const found=state.rows.filter(r=>call.filters.every(([k,v])=>r[k]===v));state.rows=state.rows.filter(r=>!found.includes(r));return {data:found.map(r=>({id:r.id})),error:null}}
      return {data:state.rows.filter(r=>call.filters.every(([k,v])=>r[k]===v)).slice(call.range[0],call.range[1]+1),error:null};
    })().then(resolve,reject)}};return q}};
  return {state,client};
}
(async()=>{
  const {state,client}=mock();let rows=[],status=[];
  const store=createStore(client,'0912',data=>rows=data,(text,ok)=>status.push({text,ok}));
  await store.refresh();assert.equal(rows.length,1);
  state.status('SUBSCRIBED');await store.refresh();
  await store.insert(row('b'));assert.equal(rows.length,2);
  assert(state.calls.find(c=>c.op==='insert').value.room_code==='0912');
  await store.remove('b');assert.equal(rows.length,1);
  assert.deepEqual(state.calls.find(c=>c.op==='delete').filters,[['room_code','0912'],['id','b']]);
  const del=state.handlers.find(h=>h.filter.event==='DELETE');assert(!del.filter.filter);
  state.rows=[];await del.cb();assert.equal(rows.length,0);
  state.rows=Array.from({length:1001},(_,i)=>row(String(i)));await store.refresh();assert.equal(rows.length,1001);
  state.fail=true;await assert.rejects(store.insert(row('bad')));await store.refresh();assert.equal(status.at(-1).ok,false);assert.equal(rows.length,1001);
  state.fail=false;await store.refresh();assert.equal(status.at(-1).ok,true);
  let release;state.slow=new Promise(r=>release=r);const waiting=store.refresh();const again=store.refresh();release();await Promise.all([waiting,again]);assert.equal(rows.length,1001);
  await store.close();const count=state.calls.length;await store.refresh();assert.equal(state.calls.length,count);assert(state.removed);
  console.log('PASS: room-scoped reads/writes/deletes, unfiltered delete subscription, pagination, errors, refresh serialization, cleanup');

  // Lightweight DOM contract tests, without launching a browser.
  const elements=new Map();
  function element(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'0',disabled:false,children:[],dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(e){this.children.push(e)},setAttribute(){}});return elements.get(id)}
  const document={body:{dataset:{}},getElementById:element,createElement:()=>({value:'',dataset:{},setAttribute(){}}),querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},visibilityState:'visible'};
  const ctx={document,window:{addEventListener(){},scrollTo(){}},navigator:{onLine:true},localStorage:{getItem(){return null},setItem(){}},supabase:{createClient:()=>client},TRIP_CONFIG:{url:'https://example.test',publishableKey:'test',room:'0912',names:['粉粉','旅伴2','旅伴3','旅伴4','旅伴5']},TripCore:core,TripStore:{createStore:()=>({refresh(){},close(){}})},setInterval(){},alert(){},console,URL,crypto,AbortSignal,fetch};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../icons.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8'),ctx);
  vm.runInContext('joinRoom();currentPayer=3;renderAll();selected[1]=false;renderPeople()',ctx);
  assert.equal(element('payer').value,3);
  vm.runInContext('expenses=[{id:"x",title:"<img onerror=alert(1)>",amount:100,payer:0,participants:[0,1],category:"餐飲"}];renderAll()',ctx);
  assert(element('expensesList').innerHTML.includes('&lt;img'));
  assert.equal(element('myPaid').textContent,'NT$100');
  assert.equal(element('myShare').textContent,'NT$50');
  assert(element('spendingBars').innerHTML.includes('NT$50'));
  assert(element('transferCount').textContent.includes('1 筆'));
  console.log('PASS: frontend initializes and renders, payer preserved across updates, database text escaped');
})().catch(e=>{console.error(e);process.exitCode=1});
