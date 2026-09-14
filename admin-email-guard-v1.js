(()=>{
'use strict';

const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
let sb=null,currentMember=null,status=null,timer=0,busy=false;
const $=id=>document.getElementById(id);

function toast(message){
  const el=$('toast');
  if(!el)return alert(message);
  el.textContent=message;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2600);
}

async function client(){
  if(sb)return sb;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
  sb.auth.onAuthStateChange(()=>setTimeout(()=>check(true),80));
  return sb;
}

function clearTimer(){
  if(timer)clearTimeout(timer);
  timer=0;
}

function fallbackFromAdmin(){
  const admin=document.querySelector('#clubTabs [data-clubview="admin"]');
  if(!admin?.classList.contains('active'))return;
  const fallback=document.querySelector('#clubTabs [data-clubview="trainer"]')||document.querySelector('#clubTabs [data-clubview="presence"]');
  fallback?.click();
}

function removeAdminUi(){
  fallbackFromAdmin();
  document.querySelector('#clubTabs [data-clubview="admin"]')?.remove();
  document.getElementById('club-sub-admin')?.remove();
}

function renderExpiredCard(message='Voor adminrechten moet je iedere 24 uur je e-mailadres opnieuw bevestigen.'){
  const root=$('clubRoot');
  if(!root||!currentMember?.id)return;
  let card=$('adminEmailReverifyCard');
  if(!card){
    card=document.createElement('div');
    card.id='adminEmailReverifyCard';
    card.className='club-card-panel auth-box';
    const first=root.querySelector(':scope > .club-card-panel');
    if(first)first.insertAdjacentElement('afterend',card);else root.prepend(card);
  }
  card.innerHTML=`<h2>Admincontrole verlopen</h2><p>${message}</p><div class="auth-message">Je blijft gewoon als lid${currentMember.is_trainer?' en trainer':''} ingelogd. Alleen Admin is geblokkeerd totdat je de nieuwe e-maillink opent.</div><div class="club-actions"><button class="primary-button" id="adminEmailReverifyBtn" type="button">Stuur nieuwe inloglink</button></div>`;
}

function applyLocked(message){
  removeAdminUi();
  renderExpiredCard(message);
  const label=document.querySelector('.tab[data-view="club"] .club-tab-label');
  if(label)label.textContent=currentMember?.is_trainer?'Club/trainer':'Club';
}

function applyFresh(){
  $('adminEmailReverifyCard')?.remove();
}

function scheduleExpiry(row){
  clearTimer();
  if(!row?.fresh||!row?.expires_at)return;
  const delay=new Date(row.expires_at).getTime()-Date.now()+250;
  if(delay<=0){timer=setTimeout(()=>check(true),250);return}
  timer=setTimeout(()=>check(true),Math.min(delay,2147483000));
}

async function readStatus(){
  const s=await client();
  const {data,error}=await s.rpc('admin_email_status');
  if(error)throw error;
  return Array.isArray(data)?data[0]||null:data;
}

async function check(force=false){
  if(busy)return;
  if(!currentMember?.id&&!force)return;
  busy=true;
  try{
    const s=await client(),{data:{session}}=await s.auth.getSession();
    if(!session){status=null;clearTimer();return}
    const row=await readStatus();
    status=row;
    if(!row?.is_admin){applyFresh();clearTimer();return}
    if(row.fresh){applyFresh();scheduleExpiry(row);return}
    applyLocked();
    clearTimer();
  }catch(error){
    console.error('Admin e-mailcontrole mislukt',error);
    if(currentMember?.role==='admin')applyLocked('De admincontrole kon niet worden bevestigd. Vraag een nieuwe e-maillink aan.');
  }finally{busy=false}
}

async function sendReverifyLink(button){
  const s=await client(),{data:{session}}=await s.auth.getSession();
  const email=String(session?.user?.email||'').trim();
  if(!email)return toast('Geen e-mailadres gevonden voor dit account.');
  button.disabled=true;
  const old=button.textContent;
  button.textContent='Inloglink versturen…';
  try{
    const {error}=await s.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});
    if(error)throw error;
    toast('Nieuwe admin-inloglink verstuurd. Controleer je e-mail.');
  }catch(error){
    console.error(error);
    toast(error.message||'Inloglink versturen is mislukt.');
  }finally{
    button.disabled=false;
    button.textContent=old;
  }
}

async function deleteMemberDirect(button){
  const id=String(button.dataset.adminDeleteMember||'');
  const name=String(button.dataset.memberName||'dit lid');
  if(!id)return;
  if(id===String(currentMember?.id||''))return toast('Je kunt je eigen adminaccount niet verwijderen.');
  if(!confirm(`Weet je zeker dat je ${name} wilt verwijderen?`))return;
  button.disabled=true;
  try{
    const s=await client(),{error}=await s.from('members').delete().eq('id',id);
    if(error)throw error;
    toast('Lid verwijderd.');
    setTimeout(()=>location.reload(),180);
  }catch(error){
    console.error(error);
    toast(error.message||'Lid verwijderen is mislukt.');
    button.disabled=false;
  }
}

function init(){
  document.addEventListener('basketball-club-rendered',event=>{
    currentMember=event.detail?.member||null;
    check(true);
  });

  document.addEventListener('click',event=>{
    const reverify=event.target.closest?.('#adminEmailReverifyBtn');
    if(reverify){
      event.preventDefault();
      event.stopImmediatePropagation();
      sendReverifyLink(reverify);
      return;
    }
    const del=event.target.closest?.('[data-admin-delete-member]');
    if(del){
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteMemberDirect(del);
    }
  },true);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')check(true);
  });
  window.addEventListener('focus',()=>check(true));
  client().then(()=>check(false)).catch(console.error);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
