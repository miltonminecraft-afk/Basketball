(()=>{
'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const labels={event_date:'Datum',arrival_time:'Aanwezig',start_time:'Start',location:'Sporthal',field:'Veld',referees:'Scheidsrechter',table:'Tafel'};
function toast(m){const e=$('toast');if(!e)return alert(m);e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2600)}
function engine(){return window.BasketballTaskImportEngine}
function parser(){return window.BasketballTaskImportParsers}
function loadLocalScript(src,globalName){
 if(window[globalName])return Promise.resolve(window[globalName]);
 return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>window[globalName]?resolve(window[globalName]):reject(Error(`${globalName} kon niet worden gestart.`));s.onerror=()=>reject(Error('Importmodule kon niet worden geladen.'));document.head.appendChild(s)});
}
async function modules(){let P=parser();if(!P)P=await loadLocalScript('./task-import-parsers-v1.js?v=4','BasketballTaskImportParsers');let E=engine();if(!E)E=await loadLocalScript('./task-import-engine-v1.js?v=4','BasketballTaskImportEngine');return{E,P}}
function memberOptions(E,item){
 const picked=new Set((item.candidates||[]).map(m=>String(m.id))),choice=E.state.nameResolutions[item.key],value=choice?.action==='new'?'new':choice?.action==='member'?`member:${choice.member_id}`:'';
 const likely=(item.candidates||[]).map(m=>`<option value="member:${esc(m.id)}" ${value===`member:${m.id}`?'selected':''}>${esc(m.full_name)}</option>`).join('');
 const rest=(E.state.members||[]).filter(m=>!picked.has(String(m.id))).slice().sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name),'nl')).map(m=>`<option value="member:${esc(m.id)}" ${value===`member:${m.id}`?'selected':''}>${esc(m.full_name)}</option>`).join('');
 return `<option value="" ${!value?'selected':''}>Kies bestaand lid of nieuw…</option>${likely?`<optgroup label="Waarschijnlijk">${likely}</optgroup>`:''}<option value="new" ${value==='new'?'selected':''}>Nieuw lid aanmaken: ${esc(item.name)}</option>${rest?`<optgroup label="Alle bestaande leden">${rest}</optgroup>`:''}`;
}
function render(){
 const E=engine(),s=E?.state,box=$('taskImportPreview');if(!box||!s)return;if(!s.rows.length){box.innerHTML='';return}
 const changed=s.resolved.filter(x=>x.event&&Object.keys(x.changes).length),fresh=s.resolved.filter(x=>!x.event),amb=s.resolved.filter(x=>x.ambiguous.length&&!x.match),unresolvedNames=s.missing.filter(x=>!s.nameResolutions[x.key]);
 const summary=`<div class="task-import-summary"><strong>${s.rows.length} regels</strong><span>${changed.length} gewijzigd</span><span>${fresh.length} nieuw</span><span>${s.removed.length} vervallen</span>${amb.length?`<span class="warn">${amb.length} wedstrijden controleren</span>`:''}${unresolvedNames.length?`<span class="warn">${unresolvedNames.length} namen controleren</span>`:''}</div>`;
 const diffs=s.resolved.filter(x=>!x.event||Object.keys(x.changes).length||x.ambiguous.length).map(x=>{
  let body='';
  if(x.ambiguous.length&&!x.match)body=`<label class="task-import-match-label">Kies wedstrijd<select data-import-match="${x.index}"><option value="">Selecteer…</option>${x.ambiguous.map(m=>`<option value="${esc(m.id)}">${esc(E.formatMatch(m))}</option>`).join('')}</select></label>`;
  else if(!x.event)body='<span class="task-import-new">Nieuw taakmoment</span>';
  else body=Object.entries(x.changes).map(([k,v])=>{const f=Array.isArray(v.from)?v.from.join(', '):v.from,to=Array.isArray(v.to)?v.to.join(', '):v.to;return`<div class="task-import-change"><b>${esc(labels[k]||k)}</b><span>${esc(f||'—')}</span><i>→</i><strong>${esc(to||'—')}</strong></div>`}).join('');
  return`<div class="task-import-diff"><div class="task-import-diff-title">${esc(x.row.home)} — ${esc(x.row.away)}</div>${body}</div>`;
 }).join('');
 const names=s.missing.length?`<div class="task-import-missing"><h4>Naamcontrole</h4><p>Deze namen zijn niet exact bekend. Kies het juiste bestaande lid of maak bewust een nieuw lid aan. De gekozen koppeling wordt onthouden voor volgende imports.</p>${s.missing.map(item=>{const c=s.nameResolutions[item.key],note=c?.action==='member'?`Wordt voortaan gekoppeld aan ${esc((s.members.find(m=>String(m.id)===String(c.member_id))||{}).full_name||'dit lid')}.`:c?.action==='new'?`Er wordt een nieuw lid “${esc(item.name)}” aangemaakt.`:'Nog controleren.';return`<div class="task-import-namecheck ${c?'resolved':''}"><strong>In bestand: ${esc(item.name)}</strong><select data-name-resolution="${esc(item.name)}">${memberOptions(E,item)}</select><span>${note}</span></div>`}).join('')}</div>`:'';
 const removed=s.removed.length?`<details class="task-import-removed"><summary>${s.removed.length} huidige taakmomenten vervallen binnen deze uploadperiode</summary>${s.removed.map(e=>`<div>${esc(String(e.event_date).slice(0,10))} · ${esc(e.home)} — ${esc(e.away)}</div>`).join('')}</details>`:'';
 const blocked=amb.length||unresolvedNames.length;
 box.innerHTML=summary+names+diffs+removed+`<div class="task-import-actions"><button type="button" class="mini-button primary" id="taskImportApply" ${blocked?'disabled':''}>Wijzigingen toepassen</button><button type="button" class="mini-button" id="taskImportCancel">Annuleren</button></div>`;
 box.querySelectorAll('[data-import-match]').forEach(sel=>sel.onchange=()=>{E.chooseMatch(Number(sel.dataset.importMatch),sel.value);render()});
 box.querySelectorAll('[data-name-resolution]').forEach(sel=>sel.onchange=()=>{E.setNameResolution(sel.dataset.nameResolution,sel.value);render()});
 $('taskImportCancel').onclick=reset;$('taskImportApply').onclick=apply;
}
function reset(){const E=engine();if(E){E.state.file=null;E.state.rows=[];E.state.resolved=[];E.state.missing=[];E.state.removed=[];E.state.nameResolutions={}}const input=$('taskImportFile');if(input)input.value='';const name=$('taskImportName');if(name)name.textContent='Nog geen bestand';render()}
async function apply(){
 const E=engine(),btn=$('taskImportApply');if(!E||E.state.busy)return;
 if(btn){btn.disabled=true;btn.textContent='Opslaan…'}
 try{const id=await E.apply();toast('Takenschema bijgewerkt.');document.dispatchEvent(new CustomEvent('task-schedule-imported',{detail:{importId:id}}));setTimeout(()=>location.reload(),250)}
 catch(e){console.error(e);toast(e.message||'Importeren is mislukt.')}
 finally{if(btn){btn.disabled=false;btn.textContent='Wijzigingen toepassen'}}
}
async function handleFile(file){
 if(!file)return;const name=$('taskImportName'),box=$('taskImportPreview');if(name)name.textContent=file.name;if(box)box.innerHTML='<div class="club-empty">Bestand analyseren…</div>';toast(`${file.name} geselecteerd. Analyseren…`);
 try{
  const {E,P}=await modules();E.state.file=file;E.state.rows=[];E.state.resolved=[];E.state.missing=[];E.state.removed=[];E.state.nameResolutions={};E.state.rows=await P.parseFile(file);if(!E.state.rows.length)throw Error('Geen taakregels gevonden.');
  const liveBox=$('taskImportPreview');if(liveBox)liveBox.innerHTML=`<div class="club-empty">${E.state.rows.length} taakregels gevonden. Wedstrijden en namen koppelen…</div>`;
  await E.loadData();E.recompute();render();toast(`${E.state.rows.length} taakregels gevonden.`);
 }catch(err){console.error(err);const E=engine();if(E){E.state.rows=[];E.state.resolved=[];E.state.missing=[];E.state.removed=[];E.state.nameResolutions={}}const liveBox=$('taskImportPreview');if(liveBox)liveBox.innerHTML=`<div class="error-box">${esc(err.message||'Bestand kon niet worden gelezen.')}</div>`;toast(err.message||'Bestand kon niet worden gelezen.')}
}
function css(){
 if($('taskImportV3Css'))return;const s=document.createElement('style');s.id='taskImportV3Css';s.textContent=`
.task-import-panel{border:1px solid var(--line);background:var(--card);border-radius:14px;padding:11px;margin:0 0 14px}.task-import-panel h4{margin:0;font-size:14px}.task-import-panel>p{margin:4px 0 10px;color:var(--muted);font-size:10px;line-height:1.4}
.task-import-picker{display:flex;gap:7px;align-items:center;flex-wrap:wrap;position:relative}.task-import-picker input[type=file]{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;overflow:hidden!important;pointer-events:none!important;left:0;bottom:0}.task-import-file-label{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 11px;border:0;border-radius:10px;background:#eef1ff;color:var(--navy);font:inherit;font-size:10px;font-weight:900;cursor:pointer}.task-import-name{font-size:9px;color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:210px}
.task-import-summary{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0 7px}.task-import-summary>*{padding:4px 7px;border-radius:999px;background:#f1f2f7;font-size:9px}.task-import-summary .warn{background:#fff0df;color:#9b4c00}.task-import-diff{border-top:1px solid var(--line);padding:8px 0}.task-import-diff-title{font-size:10px;font-weight:900;margin-bottom:4px}
.task-import-change{display:grid;grid-template-columns:74px minmax(0,1fr) 12px minmax(0,1fr);gap:4px;align-items:center;font-size:9px}.task-import-change b{color:var(--muted)}.task-import-change span{text-decoration:line-through;color:var(--muted)}.task-import-change i{text-align:center}.task-import-change strong{overflow-wrap:anywhere}.task-import-new{font-size:9px;color:#23764a;font-weight:900}
.task-import-match-label{display:block;font-size:9px;color:#a64700;font-weight:900}.task-import-match-label select{width:100%;margin-top:4px;min-height:36px;border:1px solid var(--line);border-radius:10px;background:var(--card);padding:0 8px;font:inherit}.task-import-missing{margin-top:8px;padding:9px;border-radius:12px;background:#fff7e9}.task-import-missing h4{font-size:11px}.task-import-missing>p{margin:3px 0 7px;font-size:9px;color:var(--muted)}.task-import-namecheck{padding:8px 0;border-top:1px solid rgba(0,0,0,.08)}.task-import-namecheck strong{display:block;font-size:10px;margin-bottom:4px}.task-import-namecheck select{width:100%;min-height:38px;border:1px solid var(--line);border-radius:10px;background:var(--card);padding:0 8px;font:inherit;font-size:10px}.task-import-namecheck span{display:block;margin-top:4px;font-size:8px;color:#9b4c00}.task-import-namecheck.resolved span{color:#23764a}.task-import-removed{font-size:9px;margin-top:8px}.task-import-removed summary{font-weight:900;cursor:pointer}.task-import-removed div{padding:3px 0;color:var(--muted)}.task-import-actions{display:flex;gap:6px;margin-top:10px}`;document.head.appendChild(s)
}
function mount(){
 const root=$('admin-agenda');if(!root||root.hidden||root.querySelector('.task-import-panel'))return;css();const head=root.querySelector('.admin-agenda-head'),panel=document.createElement('div');panel.className='task-import-panel';panel.innerHTML=`<h4>Takenschema importeren</h4><p>PDF of Excel. Eerst worden wedstrijden en namen gecontroleerd. Afwijkende namen kunnen blijvend aan een bestaand lid worden gekoppeld.</p><div class="task-import-picker"><button type="button" class="task-import-file-label" id="taskImportChoose">Bestand kiezen</button><input id="taskImportFile" type="file" aria-label="Takenschema kiezen" accept=".pdf,.xlsx,.xls,.xlsm,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><span class="task-import-name" id="taskImportName">Nog geen bestand</span></div><div id="taskImportPreview"></div>`;if(head)head.insertAdjacentElement('afterend',panel);else root.prepend(panel);const E=engine();if(E?.state?.file){$('taskImportName').textContent=E.state.file.name;if(E.state.rows?.length)render()}
}
function init(){css();mount();document.addEventListener('admin-agenda-refreshed',mount);document.addEventListener('click',e=>{const b=e.target.closest?.('#taskImportChoose');if(!b)return;const input=$('taskImportFile');if(!input)return;input.value='';input.click()});document.addEventListener('change',e=>{const input=e.target;if(!(input instanceof HTMLInputElement)||input.id!=='taskImportFile')return;handleFile(input.files?.[0])})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
