(()=>{
'use strict';

const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const DAY_NAMES={1:'Ma',2:'Di',3:'Wo',4:'Do',5:'Vr',6:'Za',7:'Zo'};
let sb=null,currentEditId='',values=new Map(),enhanceTimer=0;

const $=id=>document.getElementById(id);
const tm=v=>String(v||'').slice(0,5);
function toast(msg){
  const el=$('toast');if(!el)return alert(msg);
  el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400);
}
async function client(){
  if(sb)return sb;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
  return sb;
}
function selectedDays(){
  return [...document.querySelectorAll('#weeklyTrainingForm input[name="trainingDay"]:checked')].map(x=>Number(x.value)).sort((a,b)=>a-b);
}
function optionLocation(selected=''){
  return `<option value="">Kies locatie</option><option value="Phoenix" ${selected==='Phoenix'?'selected':''}>Phoenix</option><option value="Eendracht" ${selected==='Eendracht'?'selected':''}>Eendracht</option>`;
}
function snapshot(){
  document.querySelectorAll('[data-day-settings]').forEach(row=>{
    const day=Number(row.dataset.daySettings);
    values.set(day,{
      start:row.querySelector('[data-day-start]')?.value||'',
      end:row.querySelector('[data-day-end]')?.value||'',
      location:row.querySelector('[data-day-location]')?.value||''
    });
  });
}
function defaultsFromLegacy(){
  const start=$('weeklyStart')?.value||'',end=$('weeklyEnd')?.value||'',location=$('weeklyLocation')?.value||'';
  for(const day of selectedDays())if(!values.has(day))values.set(day,{start,end,location});
}
function renderDayRows(){
  snapshot();defaultsFromLegacy();
  const box=$('trainingPerDayFields');if(!box)return;
  const days=selectedDays();
  box.innerHTML=days.length?days.map(day=>{
    const v=values.get(day)||{start:'',end:'',location:''};
    return `<div class="training-day-settings" data-day-settings="${day}">
      <strong>${DAY_NAMES[day]}</strong>
      <label>Start<input data-day-start type="time" value="${v.start}"></label>
      <label>Einde<input data-day-end type="time" value="${v.end}"></label>
      <label>Locatie<select data-day-location>${optionLocation(v.location)}</select></label>
    </div>`;
  }).join(''):'<div class="training-day-settings-empty">Vink één of meerdere trainingsdagen aan.</div>';
}
function hideLegacyFields(form){
  for(const id of ['weeklyStart','weeklyEnd','weeklyLocation']){
    const el=$(id),label=el?.closest('label');
    if(label)label.hidden=true;
  }
}
function injectCss(){
  if($('trainingPerDayCss'))return;
  const s=document.createElement('style');s.id='trainingPerDayCss';
  s.textContent=`
    .training-per-day-fields{grid-column:1/-1;display:grid;gap:8px}
    .training-day-settings{display:grid;grid-template-columns:44px 1fr 1fr 1fr;gap:8px;align-items:end;padding:9px;border:1px solid var(--line);border-radius:12px;background:#f7f8fb}
    .training-day-settings>strong{align-self:center;font-size:12px}
    .training-day-settings label{font-size:9px!important;font-weight:850!important;color:var(--muted)!important}
    .training-day-settings input,.training-day-settings select{width:100%;margin-top:4px;min-height:40px;border:1px solid var(--line);border-radius:10px;background:var(--card);padding:0 8px;font:inherit;font-size:11px;color:var(--ink)}
    .training-day-settings-empty{padding:9px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);font-size:9px}
    @media(max-width:560px){.training-day-settings{grid-template-columns:34px 1fr 1fr}.training-day-settings label:last-child{grid-column:2/-1}}
  `;
  document.head.appendChild(s);
}
function enhance(){
  const form=$('weeklyTrainingForm');if(!form)return;
  injectCss();
  hideLegacyFields(form);
  let box=$('trainingPerDayFields');
  if(!box){
    box=document.createElement('div');box.id='trainingPerDayFields';box.className='training-per-day-fields';
    form.querySelector('.training-days')?.insertAdjacentElement('afterend',box);
  }
  if(form.dataset.perDayEnhanced!=='1'){
    form.dataset.perDayEnhanced='1';
    form.querySelectorAll('input[name="trainingDay"]').forEach(cb=>cb.addEventListener('change',renderDayRows));
    $('weeklyTeam')?.addEventListener('change',()=>{values.clear();renderDayRows()});
  }
  form.onsubmit=savePerDay;
  renderDayRows();
}
function scheduleEnhance(delay=20){
  clearTimeout(enhanceTimer);enhanceTimer=setTimeout(enhance,delay);
}
async function savePerDay(e){
  e.preventDefault();e.stopImmediatePropagation();
  snapshot();
  const team=$('weeklyTeam')?.value||'',days=selectedDays();
  if(!team||!days.length)return toast('Kies een team en minimaal één trainingsdag.');
  const rows=[];
  for(const day of days){
    const v=values.get(day)||{};
    if(!v.start||!v.end||!v.location)return toast(`Vul voor ${DAY_NAMES[day]} start, einde en locatie in.`);
    if(v.end<=v.start)return toast(`Eindtijd van ${DAY_NAMES[day]} moet na de starttijd liggen.`);
    rows.push({day,...v});
  }
  const s=await client();
  if(currentEditId){
    if(rows.length!==1)return toast('Bij wijzigen kies je één trainingsdag.');
    const v=rows[0];
    const {error}=await s.from('training_slots').update({
      team_id:team,weekday:v.day,start_time:v.start,end_time:v.end,location:v.location,updated_at:new Date().toISOString()
    }).eq('id',currentEditId);
    if(error)return toast(error.message);
    currentEditId='';values.clear();toast('Training gewijzigd.');
  }else{
    const {data:existing,error:readError}=await s.from('training_slots').select('team_id,weekday,start_time,end_time,location').eq('team_id',team).eq('active',true);
    if(readError)return toast(readError.message);
    const known=new Set((existing||[]).map(x=>`${x.weekday}|${tm(x.start_time)}|${tm(x.end_time)}|${x.location||''}`));
    const inserts=rows.filter(v=>!known.has(`${v.day}|${v.start}|${v.end}|${v.location}`)).map(v=>({
      team_id:team,weekday:v.day,start_time:v.start,end_time:v.end,location:v.location,active:true
    }));
    if(!inserts.length)return toast('Deze training(en) bestaan al.');
    const {error}=await s.from('training_slots').insert(inserts);
    if(error)return toast(error.message);
    values.clear();toast(inserts.length===1?'Training toegevoegd.':`${inserts.length} trainingen toegevoegd.`);
  }
  document.dispatchEvent(new CustomEvent('training-data-changed'));
  scheduleEnhance(250);
}
function init(){
  injectCss();scheduleEnhance(200);
  document.addEventListener('click',e=>{
    const edit=e.target.closest?.('[data-weekly-edit]');
    if(edit){currentEditId=edit.dataset.weeklyEdit||'';values.clear();setTimeout(()=>scheduleEnhance(10),0);return}
    if(e.target.closest?.('#weeklyCancel')){currentEditId='';values.clear();setTimeout(()=>scheduleEnhance(10),0)}
    if(e.target.closest?.('[data-adminview="agenda"]'))scheduleEnhance(120);
  },true);
  document.addEventListener('basketball-admin-view-changed',e=>{if(e.detail?.view==='agenda')scheduleEnhance(100)});
  document.addEventListener('basketball-club-rendered',()=>scheduleEnhance(180));
  document.addEventListener('training-data-changed',()=>scheduleEnhance(180));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
