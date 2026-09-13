(()=>{
'use strict';
const SUPABASE_URL='https://elpnfmlrkoemjrnzaeok.supabase.co';
const SUPABASE_KEY='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
let client=null;
let adminLoading=false;
let bootstrapLoading=false;

const esc=value=>String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));

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

async function enhanceBootstrapAdmin(){
  const form=document.getElementById('claimAdminForm');
  if(!form||document.getElementById('bootstrapMemberSelect')||bootstrapLoading)return;
  bootstrapLoading=true;
  try{
    const supabase=await getClient();
    const {data,error}=await supabase.rpc('bootstrap_admin_member_choices');
    if(error)throw error;
    if(!document.getElementById('claimAdminForm'))return;

    const members=data||[];
    const selectLabel=document.createElement('label');
    selectLabel.innerHTML=`Bestaand lid<select id="bootstrapMemberSelect" required>${members.length?members.map(m=>`<option value="${m.id}">${esc(m.full_name)}</option>`).join(''):'<option value="">Geen bestaand lid beschikbaar</option>'}</select>`;
    form.insertBefore(selectLabel,form.firstElementChild);

    const submit=form.querySelector('button[type="submit"]');
    if(submit){
      submit.textContent='Maak geselecteerd lid eerste admin';
      if(!members.length)submit.disabled=true;
    }

    form.addEventListener('submit',async event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      const memberId=document.getElementById('bootstrapMemberSelect')?.value;
      const code=document.getElementById('adminSetupCode')?.value.trim();
      if(!memberId||!code)return;
      if(submit)submit.disabled=true;
      const {error:claimError}=await supabase.rpc('claim_first_admin_existing',{p_code:code,p_member_id:memberId});
      if(claimError){
        if(submit)submit.disabled=false;
        toast(claimError.message);
        return;
      }
      toast('Bestaand lid is als eerste administrator geactiveerd.');
      setTimeout(()=>location.reload(),500);
    },true);
  }catch(error){
    console.error(error);
  }finally{
    bootstrapLoading=false;
  }
}

async function enhanceAdminMembers(){
  const target=document.getElementById('admin-members');
  if(!target)return;
  hideRoleSelector();
  if(document.getElementById('adminPromotePanel')||adminLoading)return;
  adminLoading=true;
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
            ${candidates.length?candidates.map(m=>`<option value="${m.id}">${esc(m.full_name||m.email||'Lid')}</option>`).join(''):'<option value="">Geen leden beschikbaar</option>'}
          </select>
        </label>
        <button class="primary-button" id="promoteMemberBtn" type="button" ${candidates.length?'':'disabled'}>Maak geselecteerd lid admin</button>
      </div>
      <div style="margin-top:10px;font-size:9px;color:#707384">Huidige admins: ${admins.length?admins.map(m=>esc(m.full_name||m.email||'Admin')).join(', '):'geen'}</div>`;

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
    adminLoading=false;
  }
}

const observer=new MutationObserver(()=>{
  enhanceBootstrapAdmin();
  enhanceAdminMembers();
});

document.addEventListener('DOMContentLoaded',()=>{
  observer.observe(document.documentElement,{childList:true,subtree:true});
  enhanceBootstrapAdmin();
  enhanceAdminMembers();
});
})();