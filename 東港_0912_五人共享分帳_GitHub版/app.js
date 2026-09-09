const avatars=["🐟","🐱","🐢","🦀","🐦"];
const personColors=["#64b6f5","#ff9eb6","#9ad5af","#ffb195","#b0bfd5"];
let names=[...TRIP_CONFIG.names];
let room=null, me=0, expenses=[], selected=[true,true,true,true,true];
let store=null, ready=false, busy=false, currentPayer=0, pendingDraft=null;
const client = supabase.createClient(TRIP_CONFIG.url, TRIP_CONFIG.publishableKey, {
  auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
  global: { fetch: (url, options={}) => fetch(url, {...options, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000)}) }
});
function preference(key,value){try{if(value!==undefined)localStorage.setItem(key,value);else return localStorage.getItem(key)}catch{} }
function setStatus(text, good){
  document.getElementById('conn').textContent=text;
  document.getElementById('syncStatus').textContent=text;
  if(good!==null) ready=good;
  document.querySelector('.sync-line')?.classList.toggle('error',good===false);
  updateButtons();
}
function updateButtons(){
  document.getElementById('addButton').disabled=!ready||busy||!navigator.onLine;
  document.querySelectorAll('[data-delete]').forEach(b=>b.disabled=!ready||busy||!navigator.onLine);
}
function refreshNow(){ if(store) return store.refresh(); }
function initJoin(){
  const sel=document.getElementById("meSelect"); sel.innerHTML="";
  names.forEach((n,i)=>{let o=document.createElement("option");o.value=i;o.textContent=`${avatars[i]} ${n}`;sel.appendChild(o)});
  const box=document.getElementById("nameInputs"); box.innerHTML="";
  names.forEach((n,i)=>{let d=document.createElement("div"); d.innerHTML=`<label>${avatars[i]} 成員 ${i+1}</label><input id="name${i}" value="${esc(n)}" readonly aria-label="成員 ${i+1}">`;box.appendChild(d)});
}
function fillDemo(){document.getElementById("roomInput").value="0912"}
function joinRoom(){
  if(store) return;
  room=TRIP_CONFIG.room;
  me=Number(document.getElementById('meSelect').value || 0);
  currentPayer=me;
  preference('donggang_me',me);
  document.getElementById('joinPanel').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('roomCode').textContent=room;
  document.getElementById('roomCodeMore').textContent=room;
  setStatus('讀取帳目中…',false);
  renderAll();
  store=TripStore.createStore(client,room,rows=>{if(JSON.stringify(rows)!==JSON.stringify(expenses)){expenses=rows;renderAll()}},setStatus);
  store.refresh();
}
function leaveRoom(){
  if(busy){alert('帳目處理中，請稍候。');return}
  if(store) store.close();
  store=null;room=null;expenses=[];ready=false;
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('joinPanel').classList.remove('hidden');
  showTab('home');
}
function showTab(tab){
  document.body.dataset.view=tab;
  ["home","add","list","settle","more"].forEach(t=>{
    document.getElementById("tab-"+t).classList.toggle("hidden",t!==tab);
    const el=document.querySelector(`[data-tab="${t}"]`);
    if(el) el.classList.toggle("active",t===tab);
  });
  window.scrollTo({top:0,behavior:"smooth"});
}
async function copyInvite(){
  const url=new URL('./',location.href).href;
  const text='東港五人共享分帳 🐟\n房間碼：0912\n'+url;
  try{await navigator.clipboard.writeText(text);alert('邀請文字已複製')}catch{prompt('請複製以下邀請文字',text)}
}
function avatarHTML(i){return '<span class="avatar" aria-hidden="true"><img src="./assets/avatar-'+i+'.svg" alt=""></span>'}
function personHTML(i){return avatarHTML(i)+esc(names[i])}
function renderPeople(){
  const holder=document.getElementById('memberCards');holder.innerHTML='';
  names.forEach((n,i)=>{const d=document.createElement('div');d.className='person'+(i===me?' active':'');d.dataset.person=i;d.innerHTML=personHTML(i);holder.appendChild(d)});
  for(const [id,isSplit] of [['payerPeople',false],['splitPeople',true]]){
    const target=document.getElementById(id);target.innerHTML='';
    names.forEach((n,i)=>{const b=document.createElement('button');const checked=isSplit?selected[i]:currentPayer===i;b.className='person'+(checked?' active':'');b.dataset.person=i;b.innerHTML=personHTML(i);b.setAttribute('aria-pressed',String(checked));b.setAttribute('aria-label',(isSplit?'分攤對象：':'付款人：')+n);b.onclick=()=>{if(isSplit)selected[i]=!selected[i];else currentPayer=i;renderPeople()};target.appendChild(b)});
  }
  const payer=document.getElementById('payer');payer.innerHTML='';
  names.forEach((n,i)=>{const o=document.createElement('option');o.value=i;o.textContent=n;payer.appendChild(o)});payer.value=currentPayer;
  payer.onchange=()=>{currentPayer=Number(payer.value);renderPeople()};
}
function renderCategories(){
  const box=document.getElementById('categoryChoices');box.innerHTML='';
  const cats=['餐飲','交通','住宿','門票','購物','其他'],icons=['utensils','car','house','ticket','shopping-bag','ellipsis'];
  cats.forEach((category,i)=>{const b=document.createElement('button');b.className='category-choice'+(document.getElementById('category').value===category?' active':'');b.dataset.category=category;b.innerHTML='<span>'+ICONS[icons[i]]+'</span>'+category;b.setAttribute('aria-pressed',String(document.getElementById('category').value===category));b.onclick=()=>{document.getElementById('category').value=category;renderCategories()};box.appendChild(b)});
}
function openSettings(){if(room)showTab('more');else document.getElementById('meSelect').focus()}
function selectAll(){selected=[true,true,true,true,true];renderPeople()}
async function addExpense(){
  if(!store||busy||!ready||!navigator.onLine) return;
  const expense={title:document.getElementById('title').value.trim()||document.getElementById('category').value,amount:document.getElementById('amount').value,payer:Number(document.getElementById('payer').value),participants:selected.flatMap((v,i)=>v?[i]:[]),category:document.getElementById('category').value};
  try{TripCore.validate(expense)}catch(e){alert(e.message);return}
  const signature=JSON.stringify(expense);
  if(!pendingDraft || pendingDraft.signature!==signature) pendingDraft={signature,id:crypto.randomUUID()};
  expense.id=pendingDraft.id;
  busy=true;updateButtons();
  try{
    await store.insert(expense);
    pendingDraft=null;
    document.getElementById('title').value='';document.getElementById('amount').value='';
    showTab('home');
  }catch(e){
    await refreshNow();
    if(expenses.some(row=>String(row.id)===expense.id)){
      pendingDraft=null;
      document.getElementById('title').value='';document.getElementById('amount').value='';showTab('home');
    }else alert('未確認新增成功：'+e.message+'\n輸入已保留。請先重新整理確認帳目，再決定是否重送。');
  }finally{busy=false;updateButtons()}
}
async function removeExpense(id){
  if(!store||busy||!ready||!navigator.onLine||!confirm('刪除這筆帳目？所有旅伴的帳本都會同步刪除。')) return;
  busy=true;updateButtons();
  try{await store.remove(id)}catch(e){alert('未確認刪除成功：'+e.message);await refreshNow()}
  finally{busy=false;updateButtons()}
}
function calc(){return TripCore.calculate(expenses)}
function renderAll(){
  if(!room)return;
  renderPeople();
  const c=calc();
  document.getElementById("myPaid").textContent=money(c.paid[me]);
  document.getElementById("myShare").textContent=money(c.shares[me]);
  document.getElementById("grandTotal").innerHTML='<span class="currency">NT$</span>'+Number(c.total).toLocaleString("zh-TW",{maximumFractionDigits:2});
  document.getElementById("expenseCount").textContent=expenses.length;
  const html=expenses.map(e=>`<div class="expense">
    <div class="expense-title"><strong>${esc(e.title)}</strong><strong>${money(e.amount)}</strong></div>
    <div class="expense-meta">${avatars[e.payer]} ${esc(names[e.payer])} 付款｜${esc(e.category)}｜分給 ${e.participants.map(i=>esc(names[i])).join("、")}<br>${esc(e.created_at?new Date(e.created_at).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",hour12:false}):"")}</div>
    <div style="margin-top:8px"><button class="danger" data-delete="${esc(e.id)}">刪除</button></div>
  </div>`).join("");
  document.getElementById("expensesList").innerHTML=html||'<div class="small">還沒有帳目。</div>';
  document.getElementById("recentExpenses").innerHTML=(expenses.slice(0,3).map(e=>`<div class="expense"><div class="expense-title"><strong>${esc(e.title)}</strong><strong>${money(e.amount)}</strong></div><div class="expense-meta">${esc(names[e.payer])} 付款</div></div>`).join(""))||"還沒有帳目。";
  document.getElementById('settlement').innerHTML=c.tx.length?c.tx.map(t=>'<div class="settle transfer-row">'+avatarHTML(t.from)+'<span class="transfer-names"><strong>'+esc(names[t.from])+'</strong> → '+esc(names[t.to])+'</span><strong>'+money(t.amt)+'</strong></div>').join(''):(expenses.length?'<div class="notice success">大家剛好結清 🎉</div>':'<div class="empty">記下第一筆支出，就能開始結算。</div>');
  document.getElementById('transferCount').textContent=c.tx.length?'共 '+c.tx.length+' 筆轉帳，即可結清所有費用 🎉':'';
  const maximum=Math.max(...c.shares,1);
  document.getElementById('spendingBars').innerHTML=c.shares.map((n,i)=>'<div class="bar-row">'+avatarHTML(i)+'<span class="bar-name">'+esc(names[i])+'</span><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="--bar:'+personColors[i]+';width:'+n/maximum*100+'%"></div></div><strong>'+money(n)+'</strong></div>').join('');
  document.getElementById("balances").innerHTML=c.net.map((v,i)=>`<div class="settle"><div class="spread"><span>${avatars[i]} <strong>${esc(names[i])}</strong></span><span>${v>=0?"應收 ":"應付 "}<strong>${money(Math.abs(v))}</strong></span></div></div>`).join("");
  bindDeletes();
  renderIcons();
}
function bindDeletes(){
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>removeExpense(b.dataset.delete));updateButtons();
}
function money(n){return "NT$"+Number(n).toLocaleString("zh-TW",{maximumFractionDigits:2})}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",(e)=>{e.preventDefault();deferredPrompt=e});
async function installApp(){
  if(deferredPrompt){
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt=null;
  }else{
    alert("iPhone：Safari → 分享 → 加入主畫面\nAndroid：瀏覽器選單 → 加到主畫面 / 安裝應用程式");
  }
}
if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"}).catch(()=>{}));
}
initJoin();
renderCategories();
renderIcons();
const savedMe=Number(preference('donggang_me'));
if(Number.isInteger(savedMe)&&savedMe>=0&&savedMe<5)document.getElementById('meSelect').value=savedMe;
window.addEventListener('offline',()=>{if(room)setStatus('目前離線，帳目可能不是最新；連線後才能新增或刪除。',false)});
window.addEventListener('online',()=>refreshNow());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshNow()});
setInterval(()=>{if(room&&navigator.onLine&&document.visibilityState==='visible')refreshNow()},15000);
