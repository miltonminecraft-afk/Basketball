(()=>{
'use strict';
const SUPABASE_URL='https://elpnfmlrkoemjrnzaeok.supabase.co';
const SUPABASE_KEY='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
let sb=null,mounting=false,editingId='',refreshTimer=0;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const tm=v=>String(v||'').slice(0,5);
function toast(msg){const el=$('toast');if(!el){alert(msg);return}el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400)}
async function client(){if(sb)return sb;const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=mod.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});return sb}
function injectCss(){if($('adminTrainingCss'))return;const s=document.createElement('style');s.id='adminTrainingCss';s.textContent=`
#adminTrainingHost[hidden]{display:none!important}
#adminTrainingHost{display:block;margin:0 0 16px}
#adminTrainingManager{margin:0 0 18px;padding:0 0 18px;border-bottom:1px solid var(--line)}
#adminTrainingManager h3{margin:6px 0 10px;font-size:16px}
#adminTrainingManager .training-manager-intro{margin:0 0 12px;color:var(--muted);font-size:10px;line-height:1.4}
.admin-training-list{display:grid;gap:8px;margin-top:12px}
.admin-training-row{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:10px 11px}
.admin-training-row strong{display:block;font-size:12px;line-height:1.3}
.admin-training-row small{display:block;margin-top:3px;color:var(--muted);font-size:9px;line-height:1.35}
.admin-training-row .mini-actions{margin-top:8px}
`;document.head.appendChild(s)}
function ensureHost(){
 const agenda=$('admin-agenda');if(!agenda)return null;
 let host=$('adminTrainingHost');
 if(!host){host=document.createElement('div');host.id='adminTrainingHost';agenda.parentNode.insertBefore(host,agenda)}
 host.hidden=agenda.hidden;
 const stray=$('adminTrainingManager');if(stray&&stray.parentElement!==host)stray.remove();
 return host;
}
function syncVisibility(){const agenda=$('admin-agenda'),host=$('adminTrainingHost');if(agenda&&host)host.hidden=agenda.hidden}
function teamOptions(teams,selected=''){return `<option value="">Hele vereniging / geen team</option>${teams.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(selected)?'selected':''}>${esc(x.team_name)}</option>`).join('')}`}
async function loadData(){const s=await client();const [{data:{session}},{data:me,error:meErr}]=await Promise.all([s.auth.getSession(),s.rpc('sync_current_member')]);if(!session||meErr||me?.role!=='admin')return null;const [{data:teams,error:te},{data:trainings,error:tr}]=await Promise.all([s.from('teams').select('*').eq('active',true).order('team_name'),s.from('training_sessions').select('*').order('training_date').order('start_time')]);if(te)throw te;if(tr)throw tr;return{me,teams:teams||[],trainings:trainings||[]}}
function rowHtml(x,teams){const team=teams.find(t=>String(t.id)===String(x.team_id));return `<div class="admin-training-row"><strong>Training · ${esc(x.title||'Training')}</strong><small>${esc(x.training_date||'')} · ${esc(tm(x.start_time)||'—')}${x.end_time?' - '+esc(tm(x.end_time)):''} · ${esc(team?.team_name||'Hele vereniging')}${x.location?' · '+esc(x.location):''}</small>${x.notes?`<small>${esc(x.notes)}</small>`:''}<div class="mini-actions"><button class="mini-button" type="button" data-training-edit="${esc(x.id)}">Wijzigen</button><button class="mini-button danger" type="button" data-training-delete="${esc(x.id)}">Verwijderen</button></div></div>`}
async function render(){const host=ensureHost();if(!host||mounting)return;mounting=true;try{injectCss();const data=await loadData();if(!data){host.innerHTML='';return}let panel=host.querySelector('#adminTrainingManager');if(!panel){panel=document.createElement('section');panel.id='adminTrainingManager';host.appendChild(panel)}let edit=data.trainings.find(x=>String(x.id)===String(editingId));if(editingId&&!edit)editingId='';edit=data.trainings.find(x=>String(x.id)===String(editingId));panel.innerHTML=`<h3>${edit?'Training wijzigen':'Training toevoegen'}</h3><p class="training-manager-intro">Voeg trainingen toe of pas bestaande trainingsdatum, tijden, team en locatie aan.</p><form id="adminTrainingForm" class="club-form"><input id="adminTrainingId" type="hidden" value="${esc(edit?.id||'')}"><div class="club-form two"><label>Team<select id="adminTrainingTeam">${teamOptions(data.teams,edit?.team_id||'')}</select></label><label>Titel<input id="adminTrainingTitle" value="${esc(edit?.title||'Training')}"></label><label>Datum<input id="adminTrainingDate" type="date" required value="${esc(edit?.training_date||'')}"></label><label>Start<input id="adminTrainingStart" type="time" required value="${esc(tm(edit?.start_time||''))}"></label><label>Einde<input id="adminTrainingEnd" type="time" value="${esc(tm(edit?.end_time||''))}"></label><label>Locatie<input id="adminTrainingLocation" value="${esc(edit?.location||'')}"></label></div><label>Opmerking<textarea id="adminTrainingNotes">${esc(edit?.notes||'')}</textarea></label><div class="club-actions"><button class="primary-button" type="submit">Training opslaan</button>${edit?'<button class="mini-button" type="button" id="adminTrainingCancel">Annuleren</button>':''}</div></form><h3>Trainingen</h3><div class="admin-training-list">${data.trainings.length?data.trainings.map(x=>rowHtml(x,data.teams)).join(''):'<div class="club-empty">Nog geen trainingen.</div>'}</div>`;
 panel.querySelector('#adminTrainingForm').onsubmit=e=>saveTraining(e,data.me.id);
 panel.querySelector('#adminTrainingCancel')?.addEventListener('click',()=>{editingId='';render()});
 panel.querySelectorAll('[data-training-edit]').forEach(b=>b.onclick=()=>{editingId=String(b.dataset.trainingEdit);render().then(()=>requestAnimationFrame(()=>$('adminTrainingForm')?.scrollIntoView({behavior:'smooth',block:'start'})))});
 panel.querySelectorAll('[data-training-delete]').forEach(b=>b.onclick=()=>deleteTraining(b.dataset.trainingDelete));
 }catch(e){console.error(e);toast(e.message||'Trainingbeheer kon niet worden geladen.')}finally{mounting=false}}
async function saveTraining(e,memberId){e.preventDefault();const id=$('adminTrainingId')?.value||'',payload={team_id:$('adminTrainingTeam')?.value||null,title:$('adminTrainingTitle')?.value.trim()||'Training',training_date:$('adminTrainingDate')?.value||'',start_time:$('adminTrainingStart')?.value||'',end_time:$('adminTrainingEnd')?.value||null,location:$('adminTrainingLocation')?.value.trim()||null,notes:$('adminTrainingNotes')?.value.trim()||null};if(!payload.training_date||!payload.start_time)return toast('Datum en starttijd zijn verplicht.');try{const s=await client();if(id){const {error}=await s.from('training_sessions').update(payload).eq('id',id);if(error)throw error}else{const {error}=await s.from('training_sessions').insert({...payload,created_by:memberId});if(error)throw error}editingId='';toast('Training opgeslagen.');await render()}catch(err){console.error(err);toast(err.message||'Training opslaan is mislukt.')}}
async function deleteTraining(id){if(!confirm('Weet je zeker dat je deze training wilt verwijderen?'))return;try{const s=await client(),{error}=await s.from('training_sessions').delete().eq('id',id);if(error)throw error;if(String(editingId)===String(id))editingId='';toast('Training verwijderd.');await render()}catch(err){console.error(err);toast(err.message||'Training verwijderen is mislukt.')}}
function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{const agenda=$('admin-agenda');if(!agenda)return;const host=ensureHost();syncVisibility();if(host&&!host.querySelector('#adminTrainingManager'))render()},40)}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-adminview]'))setTimeout(()=>{syncVisibility();if(e.target.closest?.('[data-adminview="agenda"]'))render()},0)},false);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
document.addEventListener('DOMContentLoaded',schedule);
})();