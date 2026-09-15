(()=>{
'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const labels={event_date:'Datum',arrival_time:'Aanwezig',start_time:'Start',location:'Sporthal',field:'Veld',referees:'Scheidsrechter',table:'Tafel'};
function toast(m){const e=$('toast');if(!e)return alert(m);e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2600)}
function engine(){return window.BasketballTaskImportEngine}
function parser(){return window.BasketballTaskImportParsers}
function render(){
 const E=engine(),s=E?.state,box=$('taskImportPreview');if(!box||!s)return;if(!s.rows.length){box.innerHTML='';return}
 const changed=s.resolved.filter(x=>x.event&&Object.keys(x.changes).length),fresh=s.resolved.filter(x=>!x.event),amb=s.resolved.filter(x=>x.ambiguous.length&&!x.match);
 const summary=`<div class="task-import-summary"><strong>${s.rows.length} regels</strong><span>${changed.length} gewijzigd</span><span>${fresh.length} nieuw</span><span>${s.removed.length} vervallen</span>${amb.length?`<span class="warn">${amb.length} controleren</span>`:''}</div>`;
 const diffs=s.resolved.filter(x=>!x.event||Object.keys(x.changes).length||x.ambiguous.length).map(x=>{
  let body='';
  if(x.ambiguous.length&&!x.match)body=`<label class="task-import-match-label">Kies wedstrijd<select data-import-match="${x.index}"><option value="">Selecteer…</option>${x.ambiguous.map(m=>`<option value="${esc(m.id)}">${esc(E.formatMatch(m))}</option>`).join('')}</select></label>`;
  else if(!x.event)body='<span class="task-import-new">Nieuw taakmoment</span>';
  else body=Object.entries(x.changes).map(([k,v])=>{const f=Array.isArray(v.from)?v.from.join(', '):v.from,to=Array.isArray(v.to)?v.to.join(', '):v.to;return`<div class="task-import-change"><b>${esc(labels[k]||k)}</b><span>${esc(f||'—')}</span><i>→</i><strong>${esc(to||'—')}</strong></div>`}).join('');
  return`<div class="task-import-diff"><div class="task-import-diff-title">${esc(x.row.home)} — ${esc(x.row.away)}</div>${body}</div>`;
 }).join('');
 const missing=s.missing.length?`<div class="task-import-missing"><h4>Niet in ledenadministratie</h4><p>Wil je deze personen aanmaken? Labels zoals Inhuur en Ouders worden niet als lid aangemaakt.</p>${s.missing.map(n=>`<label><input type="checkbox" data-create-member value="${esc(n)}" checked> ${esc(n)}</label>`).join('')}</div>`:'';
 const removed=s.removed.length?`<details class="task-import-removed"><summary>${s.removed.length} huidige taakmomenten vervallen binnen deze uploadperiode</summary>${s.removed.map(e=>`<div>${esc(String(e.event_date).slice(0,10))} · ${esc(e.home)} — ${esc(e.away)}</div>`).join('')}</details>`:'';
 box.innerHTML=summary+diffs+missing+removed+`<div class="task-import-actions"><button type="button" class="mini-button primary" id="taskImportApply" ${amb.length?'disabled':''}>Wijzigingen toepassen</button><button type="button" class="mini-button" id="taskImportCancel">Annuleren</button></div>`;
 box.querySelectorAll('[data-import-match]').forEach(sel=>sel.onchange=()=>{E.chooseMatch(Number(sel.dataset.importMatch),sel.value);render()});
 $('taskImportCancel').onclick=reset;$('taskImportApply').onclick=apply;
}
function reset(){const E=engine();if(E){E.state.file=null;E.state.rows=[];E.state.resolved=[];E.state.missing=[];E.state.removed=[]}const input=$('taskImportFile');if(input)input.value='';const name=$('taskImportName');if(name)name.textContent='Nog geen bestand';render()}
async function apply(){
 const E=engine(),btn=$('taskImportApply');if(!E||E.state.busy)return;
 if(btn){btn.disabled=true;btn.textContent='Opslaan…'}
 try{
  const create=[...document.querySelectorAll('[data-create-member]:checked')].map(x=>x.value),id=await E.apply(create);
  toast('Takenschema bijgewerkt.');document.dispatchEvent(new CustomEvent('task-schedule-imported',{detail:{importId:id}}));setTimeout(()=>location.reload(),250);
 }catch(e){console.error(e);toast(e.message||'Importeren is mislukt.')}
 finally{if(btn){btn.disabled=false;btn.textContent='Wijzigingen toepassen'}}
}
function css(){
 if($('taskImportV1Css'))return;
 const s=document.createElement('style');s.id='taskImportV1Css';s.textContent=`
.task-import-panel{border:1px solid var(--line);background:var(--card);border-radius:14px;padding:11px;margin:0 0 14px}.task-import-panel h4{margin:0;font-size:14px}.task-import-panel>p{margin:4px 0 10px;color:var(--muted);font-size:10px;line-height:1.4}
.task-import-picker{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.task-import-picker input{display:none}.task-import-file-label{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 11px;border-radius:10px;background:#eef1ff;color:var(--navy);font-size:10px;font-weight:900;cursor:pointer}.task-import-name{font-size:9px;color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:210px}
.task-import-summary{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0 7px}.task-import-summary>*{padding:4px 7px;border-radius:999px;background:#f1f2f7;font-size:9px}.task-import-summary .warn{background:#fff0df;color:#9b4c00}.task-import-diff{border-top:1px solid var(--line);padding:8px 0}.task-import-diff-title{font-size:10px;font-weight:900;margin-bottom:4px}
.task-import-change{display:grid;grid-template-columns:74px minmax(0,1fr) 12px minmax(0,1fr);gap:4px;align-items:center;font-size:9px}.task-import-change b{color:var(--muted)}.task-import-change span{text-decoration:line-through;color:var(--muted)}.task-import-change i{text-align:center}.task-import-change strong{overflow-wrap:anywhere}.task-import-new{font-size:9px;color:#23764a;font-weight:900}
.task-import-match-label{display:block;font-size:9px;color:#a64700;font-weight:900}.task-import-match-label select{width:100%;margin-top:4px;min-height:36px;border:1px solid var(--line);border-radius:10px;background:var(--card);padding:0 8px;font:inherit}.task-import-missing{margin-top:8px;padding:9px;border-radius:12px;background:#fff7e9}.task-import-missing h4{font-size:11px}.task-import-missing p{margin:3px 0 7px;font-size:9px;color:var(--muted)}.task-import-missing label{display:block;font-size:9px;margin:5px 0}.task-import-removed{font-size:9px;margin-top:8px}.task-import-removed summary{font-weight:900;cursor:pointer}.task-import-removed div{padding:3px 0;color:var(--muted)}.task-import-actions{display:flex;gap:6px;margin-top:10px}`;
 document.head.appendChild(s);
}
function mount(){
 const root=$('admin-agenda');if(!root||root.hidden||root.querySelector('.task-import-panel'))return;css();
 const head=root.querySelector('.admin-agenda-head'),panel=document.createElement('div');panel.className='task-import-panel';
 panel.innerHTML=`<h4>Takenschema importeren</h4><p>PDF of Excel. Eerst matchen op team + tegenstander + thuis/uit; datum, tijd en locatie zijn alleen hulpsignalen.</p><div class="task-import-picker"><label class="task-import-file-label" for="taskImportFile">Bestand kiezen</label><input id="taskImportFile" type="file" accept=".pdf,.xlsx,.xls,.xlsm,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><span class="task-import-name" id="taskImportName">Nog geen bestand</span></div><div id="taskImportPreview"></div>`;
 if(head)head.insertAdjacentElement('afterend',panel);else root.prepend(panel);
 $('taskImportFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;const E=engine();E.state.file=file;$('taskImportName').textContent=file.name;$('taskImportPreview').innerHTML='<div class="club-empty">Bestand analyseren…</div>';try{await E.loadData();E.state.rows=await parser().parseFile(file);if(!E.state.rows.length)throw Error('Geen taakregels gevonden.');E.recompute();render()}catch(err){console.error(err);E.state.rows=[];$('taskImportPreview').innerHTML=`<div class="error-box">${esc(err.message||'Bestand kon niet worden gelezen.')}</div>`}};
}
function init(){css();mount();document.addEventListener('admin-agenda-refreshed',mount)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();