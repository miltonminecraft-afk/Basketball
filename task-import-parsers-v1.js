(()=>{
'use strict';
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function cleanTeam(v){return String(v||'').replace(/\s+-\s+/g,' ').replace(/\s+/g,' ').trim()}
function normalizeDate(v){
 if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
 const s=String(v||'').trim(),m=s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
 if(m)return`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
 if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
 return'';
}
function normalizeTime(v){
 if(v instanceof Date&&!isNaN(v))return`${String(v.getHours()).padStart(2,'0')}:${String(v.getMinutes()).padStart(2,'0')}`;
 if(typeof v==='number'&&v>=0&&v<1){const mins=Math.round(v*1440);return`${String(Math.floor(mins/60)%24).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`}
 const m=String(v||'').match(/(\d{1,2})[:.](\d{2})/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:'';
}
function makeRow(cols){
 const officials=(cols.officials||[]).map(x=>String(x||'').trim()).filter(Boolean);
 return{date:normalizeDate(cols.date),arrivalTime:normalizeTime(cols.arrival),startTime:normalizeTime(cols.start),home:cleanTeam(cols.home),away:cleanTeam(cols.away),field:String(cols.field||'').trim(),location:String(cols.location||'').trim(),referees:officials.slice(0,2),table:officials.slice(2)};
}
async function loadXlsx(){
 if(window.XLSX)return;
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=resolve;s.onerror=()=>reject(Error('Excel-parser kon niet worden geladen.'));document.head.appendChild(s)});
}
async function parseExcel(file){
 await loadXlsx();
 const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true}),sh=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:'',raw:true});
 const hi=rows.findIndex(r=>r.some(x=>norm(x)==='datum')&&r.some(x=>norm(x)==='aanvang'));
 if(hi<0)throw Error('Kolomkoppen Datum/Aanvang niet gevonden.');
 const h=rows[hi].map(x=>norm(x)),di=h.findIndex(x=>x==='datum'),ai=h.findIndex(x=>x==='aanvang'),si=h.findIndex(x=>x==='starttijd'||x==='start');
 const teamIdx=h.map((x,i)=>x==='team'?i:-1).filter(i=>i>=0),fi=h.findIndex(x=>x==='veld'),li=h.findIndex(x=>x==='sporthal'||x==='locatie'),oi=h.findIndex(x=>x==='officials');
 if(teamIdx.length<2)throw Error('Twee Team-kolommen zijn niet gevonden.');
 return rows.slice(hi+1).map(r=>makeRow({date:r[di],arrival:r[ai],start:r[si],home:r[teamIdx[0]],away:r[teamIdx[1]],field:r[fi],location:r[li],officials:r.slice(oi>=0?oi:Math.max(fi,li)+1)})).filter(r=>r.date&&r.startTime&&r.home&&r.away);
}
async function parsePdf(file){
 const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[];
 for(let p=1;p<=pdf.numPages;p++){
  const page=await pdf.getPage(p),tc=await page.getTextContent(),items=tc.items.map(i=>({text:String(i.str||'').trim(),x:i.transform[4],y:i.transform[5],w:Number(i.width)||0})).filter(i=>i.text);
  const header=(name,n=0)=>items.filter(i=>norm(i.text)===name).sort((a,b)=>a.x-b.x)[n];
  const datum=header('datum'),aanvang=header('aanvang'),start=header('starttijd'),team1=header('team',0),field=header('veld'),loc=header('sporthal'),officials=header('officials');
  if(!datum||!aanvang||!start||!team1||!field||!loc||!officials)continue;
  const dateCut=(datum.x+aanvang.x)/2,arrivalCut=(aanvang.x+start.x)/2,startCut=(start.x+team1.x)/2,fieldCut=field.x-5,locCut=loc.x-3,offCut=officials.x-5;
  const groups=[];
  for(const it of items.sort((a,b)=>b.y-a.y||a.x-b.x)){let g=groups.find(x=>Math.abs(x.y-it.y)<2.2);if(!g){g={y:it.y,items:[]};groups.push(g)}g.items.push(it)}
  const dataGroups=groups.filter(g=>/\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(g.items.map(i=>i.text).join(' '))),freq=new Map();
  for(const it of dataGroups.flatMap(g=>g.items).filter(i=>i.x>=offCut)){const k=Math.round(it.x/2)*2;freq.set(k,(freq.get(k)||0)+1)}
  const anchors=[];
  for(const [x,count] of [...freq.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0])){if(count<2)continue;if(anchors.every(a=>Math.abs(a-x)>35))anchors.push(x);if(anchors.length>=6)break}
  anchors.sort((a,b)=>a-b);
  for(const g of dataGroups){
   const its=[...g.items].sort((a,b)=>a.x-b.x),dateItems=its.filter(i=>i.x<dateCut),arrivalItems=its.filter(i=>i.x>=dateCut&&i.x<arrivalCut),startItems=its.filter(i=>i.x>=arrivalCut&&i.x<startCut),teamItems=its.filter(i=>i.x>=startCut&&i.x<fieldCut),vs=teamItems.findIndex(i=>norm(i.text)==='vs');
   if(vs<0)continue;
   const fieldItems=its.filter(i=>i.x>=fieldCut&&i.x<locCut),locItems=its.filter(i=>i.x>=locCut&&i.x<offCut),offItems=its.filter(i=>i.x>=offCut);
   let names=[];
   if(anchors.length){
    let cur=[],active=-1;
    for(const it of offItems){const a=anchors.findIndex(x=>Math.abs(it.x-x)<=8);if(a>=0&&cur.length&&a!==active){names.push(cur.join(' ').trim());cur=[]}if(a>=0)active=a;cur.push(it.text)}
    if(cur.length)names.push(cur.join(' ').trim());
   }else{
    let cur=[],prev=null;
    for(const it of offItems){if(cur.length&&prev!==null&&it.x-prev>10){names.push(cur.map(x=>x.text).join(' '));cur=[]}cur.push(it);prev=it.x+it.w}
    if(cur.length)names.push(cur.map(x=>x.text).join(' '));
   }
   const row=makeRow({date:dateItems.map(i=>i.text).join(' '),arrival:arrivalItems.map(i=>i.text).join(' '),start:startItems.map(i=>i.text).join(' '),home:teamItems.slice(0,vs).map(i=>i.text).join(' '),away:teamItems.slice(vs+1).map(i=>i.text).join(' '),field:fieldItems.map(i=>i.text).join(' '),location:locItems.map(i=>i.text).join(' '),officials:names});
   if(row.date&&row.startTime&&row.home&&row.away)out.push(row);
  }
 }
 if(!out.length)throw Error('Geen taakregels in de PDF herkend.');
 return out;
}
async function parseFile(file){
 const name=file.name.toLowerCase();
 if(name.endsWith('.pdf'))return parsePdf(file);
 if(/\.(xlsx|xls|xlsm|csv)$/.test(name))return parseExcel(file);
 throw Error('Gebruik een PDF, Excel- of CSV-bestand.');
}
window.BasketballTaskImportParsers={parseFile,norm};
})();