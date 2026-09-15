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
function splitCombinedItem(item,bounds){
 const text=String(item.text||'').trim(),x=Number(item.x)||0,w=Math.max(Number(item.w)||0,1),end=x+w;
 const cuts=(bounds||[]).filter(c=>c>x+1&&c<end-1).sort((a,b)=>a-b);
 if(!text||!cuts.length)return[{...item,text}];
 const spaces=[...text.matchAll(/\s+/g)].map(m=>m.index+m[0].length).filter(i=>i>0&&i<text.length),picked=[];
 let last=0;
 for(const cut of cuts){
  const rough=Math.round(((cut-x)/w)*text.length),candidates=spaces.filter(i=>i>last+1&&i<text.length-1);
  let idx=candidates.length?candidates.reduce((best,i)=>Math.abs(i-rough)<Math.abs(best-rough)?i:best,candidates[0]):Math.max(last+1,Math.min(text.length-1,rough));
  if(Math.abs(idx-rough)>8)idx=Math.max(last+1,Math.min(text.length-1,rough));
  if(idx<=last)continue;picked.push({idx,cut});last=idx;
 }
 const out=[];let pos=0,px=x;
 for(const p of picked){const part=text.slice(pos,p.idx).trim();if(part)out.push({text:part,x:px,y:item.y,w:Math.max(1,p.cut-px)});pos=p.idx;px=p.cut}
 const tail=text.slice(pos).trim();if(tail)out.push({text:tail,x:px,y:item.y,w:Math.max(1,end-px)});
 return out;
}
async function parsePdf(file){
 const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[];
 for(let p=1;p<=pdf.numPages;p++){
  const page=await pdf.getPage(p),tc=await page.getTextContent(),items=tc.items.map(i=>({text:String(i.str||'').trim(),x:Number(i.transform?.[4])||0,y:Number(i.transform?.[5])||0,w:Number(i.width)||0})).filter(i=>i.text);
  const exact=name=>items.filter(i=>norm(i.text)===name).sort((a,b)=>b.y-a.y||a.x-b.x)[0];
  const field=exact('veld'),loc=exact('sporthal')||exact('locatie'),officials=exact('officials');
  if(!field||!loc||!officials)continue;
  const fieldStart=field.x-8,locStart=loc.x-8,offStart=officials.x-4,groups=[];
  for(const it of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){let g=groups.find(x=>Math.abs(x.y-it.y)<2.2);if(!g){g={y:it.y,items:[]};groups.push(g)}g.items.push(it)}
  const dataGroups=groups.filter(g=>/\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(g.items.map(i=>i.text).join(' '))),freq=new Map();
  for(const it of dataGroups.flatMap(g=>g.items).filter(i=>i.x>=offStart)){const k=Math.round(it.x/2)*2;freq.set(k,(freq.get(k)||0)+1)}
  const anchors=[];
  for(const [x,count] of [...freq.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0])){if(count<2)continue;if(anchors.every(a=>Math.abs(a-x)>25))anchors.push(x);if(anchors.length>=6)break}
  if(anchors.every(a=>Math.abs(a-officials.x)>18))anchors.push(officials.x);
  anchors.sort((a,b)=>a-b);
  if(!anchors.length)anchors.push(officials.x);
  for(const g of dataGroups){
   const its=[...g.items].sort((a,b)=>a.x-b.x),pre=its.filter(i=>i.x<fieldStart).map(i=>i.text).join(' ').replace(/\s+/g,' ').trim(),dateMatch=pre.match(/(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/g),times=[...pre.matchAll(/(?<!\d)(\d{1,2})[:.](\d{2})(?!\d)/g)];
   if(!dateMatch?.length||times.length<2)continue;
   const teamText=pre.slice(times[1].index+times[1][0].length).trim(),vs=teamText.search(/\bVS\b/i);
   if(vs<0)continue;
   const home=teamText.slice(0,vs).trim(),away=teamText.slice(vs).replace(/^\s*VS\s*/i,'').trim();
   if(!home||!away)continue;
   const fieldText=its.filter(i=>i.x>=fieldStart&&i.x<locStart).map(i=>i.text).join(' ').replace(/\s+/g,' ').trim(),frags=[];
   for(const it of its){if(it.x+it.w<locStart)continue;frags.push(...splitCombinedItem(it,anchors))}
   const firstAnchor=anchors[0],location=frags.filter(f=>f.x>=locStart&&f.x<firstAnchor-8).map(f=>f.text).join(' ').replace(/\s+/g,' ').trim(),slots=Array.from({length:anchors.length},()=>[]);
   for(const f of frags){
    if(f.x<firstAnchor-8)continue;
    let slot=0;
    for(let i=anchors.length-1;i>=0;i--){if(f.x>=anchors[i]-8){slot=i;break}}
    slots[slot].push(f.text);
   }
   const names=slots.map(s=>s.join(' ').replace(/\s+/g,' ').trim()).filter(Boolean),row=makeRow({date:dateMatch[0],arrival:times[0][0],start:times[1][0],home,away,field:fieldText,location,officials:names});
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