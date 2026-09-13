(()=>{
'use strict';
const SUPABASE_URL='https://elpnfmlrkoemjrnzaeok.supabase.co';
const SUPABASE_KEY='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const FEDERATION_ID='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const ARGON_CLUB_ID='a4a2e2fa-0635-46a5-8969-1d0fef40444f';
const ARGON_CLUB_NAME='SV Argon';
let client=null;
let adminLoading=false;
let bootstrapLoading=false;
let dataBootstrapRunning=false;

const esc=value=>String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const norm=value=>String(value||'').trim().toLowerCase();

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

async function currentAdmin(){
  const supabase=await getClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return null;
  const {data}=await supabase.from('members').select('id,role,active').eq('auth_user_id',user.id).maybeSingle();
  return data?.role==='admin'&&data.active?data:null;
}

async function syncArgonTeams(supabase){
  try{
    const response=await fetch(`https://api.foys.io/competition/public-api/v1/organisations/${ARGON_CLUB_ID}/teams`,{headers:{Accept:'application/json','X-FederationID':FEDERATION_ID},cache:'no-store'});
    if(!response.ok)return;
    const rows=await response.json();
    const payload=(Array.isArray(rows)?rows:[]).filter(x=>x.guid).map(x=>({club_id:ARGON_CLUB_ID,club_name:ARGON_CLUB_NAME,foy_team_guid:x.guid,foy_team_id:x.id,team_name:x.name,active:true}));
    if(payload.length)await supabase.from('teams').upsert(payload,{onConflict:'foy_team_guid'});
  }catch(error){console.warn(error);}
}

async function linkExistingAssignments(supabase,members){
  const {data:rows,error}=await supabase.from('task_assignments').select('id,assigned_name,assigned_member_id').is('assigned_member_id',null);
  if(error||!rows?.length)return;
  const byName=new Map((members||[]).filter(m=>m.active&&m.full_name).map(m=>[norm(m.full_name),m.id]));
  for(const row of rows){
    const id=byName.get(norm(row.assigned_name));
    if(id)await supabase.from('task_assignments').update({assigned_member_id:id}).eq('id',row.id);
  }
}

async function ensureBootstrapData(){
  if(dataBootstrapRunning)return;
  dataBootstrapRunning=true;
  try{
    const supabase=await getClient();
    const admin=await currentAdmin();
    if(!admin)return;
    await syncArgonTeams(supabase);
    const taskResponse=await fetch('./data/tasks.json',{cache:'no-store'});
    if(!taskResponse.ok)return;
    const json=await taskResponse.json();
    const [{data:members},{data:teams},{data:existingEvents}]=await Promise.all([
      supabase.from('members').select('id,full_name,active'),
      supabase.from('teams').select('id,team_name'),
      supabase.from('task_events').select('id,legacy_id')
    ]);
    const memberByName=new Map((members||[]).filter(m=>m.active&&m.full_name).map(m=>[norm(m.full_name),m.id]));
    const teamByName=new Map((teams||[]).map(t=>[norm(t.team_name),t.id]));
    const existingLegacyIds=new Set((existingEvents||[]).map(e=>e.legacy_id).filter(Boolean));
    for(const row of json.tasks||[]){
      if(existingLegacyIds.has(row.id))continue;
      const shortHome=String(row.home||'').replace(/^SV Argon\s+/i,'').trim();
      const {data:event,error}=await supabase.from('task_events').insert({legacy_id:row.id,team_id:teamByName.get(norm(shortHome))||null,event_date:row.date,arrival_time:row.arrivalTime,start_time:row.startTime,home:row.home,away:row.away,location:row.location,field:row.field,active:true,created_by:admin.id}).select().single();
      if(error){if(error.code==='23505')continue;console.warn(error);continue;}
      const assignments=[];
      (row.referees||[]).forEach((name,index)=>assignments.push({task_event_id:event.id,assigned_name:name,assigned_member_id:memberByName.get(norm(name))||null,role:'referee',slot:index+1}));
      (row.table||[]).forEach((name,index)=>assignments.push({task_event_id:event.id,assigned_name:name,assigned_member_id:memberByName.get(norm(name))||null,role:'table',slot:index+1}));
      if(assignments.length)await supabase.from('task_assignments').insert(assignments);
      existingLegacyIds.add(row.id);
    }
    await linkExistingAssignments(supabase,members||[]);
  }catch(error){console.error(error)}finally{dataBootstrapRunning=false}
}

async function enhanceBootstrapAdmin(){
  const oldForm=document.getElementById('claimAdminForm');
  if(!oldForm||oldForm.dataset.recoveryReady==='1'||bootstrapLoading)return;
  bootstrapLoading=true;
  try{
    const supabase=await getClient();
    const {data,error}=await supabase.rpc('bootstrap_admin_member_choices');
    if(error)throw error;
    const current=document.getElementById('claimAdminForm');
    if(!current)return;
    const members=data||[];
    const form=current.cloneNode(false);
    form.id='claimAdminForm';
    form.dataset.recoveryReady='1';
    form.className='club-form';
    form.innerHTML=`<label>Bestaand lid<select id="bootstrapMemberSelect" required>${members.length?members.map(m=>`<option value="${m.id}">${esc(m.full_name)}</option>`).join(''):'<option value="">Geen bestaand lid beschikbaar</option>'}</select></label><button class="primary-button" type="submit" ${members.length?'':'disabled'}>Herstel en maak geselecteerd lid admin</button>`;
    current.replaceWith(form);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const memberId=document.getElementById('bootstrapMemberSelect')?.value;
      if(!memberId)return;
      const button=form.querySelector('button[type="submit"]');
      if(button)button.disabled=true;
      const {error:claimError}=await supabase.rpc('recover_first_admin_existing',{p_member_id:memberId});
      if(claimError){if(button)button.disabled=false;toast(claimError.message);return}
      toast('Adminaccount hersteld.');
      setTimeout(()=>location.reload(),400);
    });
  }catch(error){console.error(error)}finally{bootstrapLoading=false}
}

const observer=new MutationObserver(()=>{enhanceBootstrapAdmin()});
document.addEventListener('DOMContentLoaded',()=>{
  observer.observe(document.documentElement,{childList:true,subtree:true});
  enhanceBootstrapAdmin();
  ensureBootstrapData();
});
})();