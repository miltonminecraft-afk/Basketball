(()=>{
'use strict';
const SUPABASE_URL='https://elpnfmlrkoemjrnzaeok.supabase.co';
const SUPABASE_KEY='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
let client=null;
let loading=false;

function toast(message){
  const el=document.getElementById('toast');
  if(!el){alert(message);return;}
  el.textContent=message;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2600);
}

async function getClient(){
  if(client)return client;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  client=mod.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
  return client;
}

function hideRoleSelector(){
  const role=document.getElementById('memberRole');
  if(!role)return;
  const memberId=document.getElementById('memberId');
  if(!memberId?.value)role.value='member';
  const label=role.closest('label');
  if(label){
    label.hidden=true;
    label.setAttribute('aria-hidden','true');
  }
}

async function enhanceAdminMembers(){
  const target=document.getElementById('admin-members');
  if(!target)return;
  hideRoleSelector();
  if(document.getElementById('adminPromotePanel')||loading)return;
  loading=true;
  try{
    const supabase=await getClient();
    const {data:members,error}=await supabase
      .from('members')
      .select('id,full_name,email,role,active')
      .order('full_name');
    if(error)throw error;

    if(!document.getElementById('admin-members'))return;
    const activeMembers=(members||[]).filter(m=>m.active);
    const candidates=activeMembers.filter(m=>m.role!=='admin');
    const admins=activeMembers.filter(m=>m.role==='admin');

    const panel=document.createElement('div');
    panel.id='adminPromotePanel';
    panel.className='club-card-panel';
    panel.style.margin='12px 0';
    panel.innerHTML=`
      <h3>Administrator toevoegen</h3>
      <p>Een administrator wordt altijd gekozen uit de bestaande ledenlijst. Nieuwe personen worden eerst als normaal lid toegevoegd.</p>
      <div class="club-form">
        <label>Bestaand lid
          <select id="promoteMemberSelect" ${candidates.length?'':'disabled'}>
            ${candidates.length
              ? candidates.map(m=>`<option value="${m.id}">${String(m.full_name||m.email||'Lid').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}</option>`).join('')
              : '<option value="">Geen leden beschikbaar</option>'}
          </select>
        </label>
        <button class="primary-button" id="promoteMemberBtn" type="button" ${candidates.length?'':'disabled'}>Maak geselecteerd lid admin</button>
      </div>
      <div style="margin-top:10px;font-size:9px;color:#707384">
        Huidige admins: ${admins.length?admins.map(m=>String(m.full_name||m.email||'Admin').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))).join(', '):'geen'}
      </div>`;

    const listHeading=[...target.querySelectorAll('h3')].find(h=>h.textContent.trim()==='Leden');
    if(listHeading)target.insertBefore(panel,listHeading);
    else target.prepend(panel);

    const btn=document.getElementById('promoteMemberBtn');
    if(btn)btn.onclick=async()=>{
      const id=document.getElementById('promoteMemberSelect')?.value;
      if(!id)return;
      btn.disabled=true;
      const {error:updateError}=await supabase.from('members').update({role:'admin',updated_at:new Date().toISOString()}).eq('id',id);
      if(updateError){btn.disabled=false;toast(updateError.message);return;}
      toast('Lid is administrator gemaakt.');
      setTimeout(()=>location.reload(),500);
    };
  }catch(error){
    console.error(error);
  }finally{
    loading=false;
  }
}

const observer=new MutationObserver(()=>enhanceAdminMembers());
document.addEventListener('DOMContentLoaded',()=>{
  observer.observe(document.documentElement,{childList:true,subtree:true});
  enhanceAdminMembers();
});
})();