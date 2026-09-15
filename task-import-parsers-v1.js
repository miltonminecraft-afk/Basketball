(()=>{
'use strict';

const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const HEADER={
  date:['datum','date','speeldatum','wedstrijddatum'],
  arrival:['aanvang','aanwezig','aanwezigheid','aankomst','melden','verzamelen','reporting'],
  start:['starttijd','start','wedstrijdstart','tipoff','tipuptijd','wedstrijdtijd','tijd'],
  home:['thuis','thuisteam','home','hometeam'],
  away:['uit','uitteam','away','awayteam'],
  team:['team','teams','wedstrijd','match','wedstrijdteams'],
  field:['veld','court','baan','field'],
  location:['sporthal','locatie','zaal','hal','accommodatie','accommodation','venue'],
  officials:['officials','official','jury','taakbezetting','bezetting'],
  referee:['scheidsrechter','scheidsrechters','scheids','referee','referees','arbiter','arbiters'],
  table:['tafel','tafelaars','tafellid','jurytafel','table','scoretable']
};
function isHeader(v,type){
  const n=norm(v);if(!n)return false;
  return HEADER[type].some(a=>n===a||n.startsWith(a));
}
function cleanTeam(v){return text(v).replace(/\s+-\s+/g,' - ').trim()}
function normalizeDate(v){
  if(v instanceof Date&&!isNaN(v))return`${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
  if(typeof v==='number'&&Number.isFinite(v)&&v>20000&&window.XLSX?.SSF?.parse_date_code){const p=XLSX.SSF.parse_date_code(v);if(p)return`${String(p.y).padStart(4,'0')}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}`}
  const s=text(v),m=s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if(m){let y=m[3];if(y.length===2)y=`20${y}`;return`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}
  const iso=s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);if(iso)return`${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`;
  return'';
}
function normalizeTime(v){
  if(v instanceof Date&&!isNaN(v))return`${String(v.getHours()).padStart(2,'0')}:${String(v.getMinutes()).padStart(2,'0')}`;
  if(typeof v==='number'&&v>=0&&v<1){const mins=Math.round(v*1440);return`${String(Math.floor(mins/60)%24).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`}
  const m=text(v).match(/(?<!\d)(\d{1,2})[:.](\d{2})(?!\d)/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:'';
}
function makeRow(cols){
  const officials=(cols.officials||[]).map(text).filter(Boolean),explicitRefs=Array.isArray(cols.referees),explicitTable=Array.isArray(cols.table);
  return{
    date:normalizeDate(cols.date),arrivalTime:normalizeTime(cols.arrival),startTime:normalizeTime(cols.start),
    home:cleanTeam(cols.home),away:cleanTeam(cols.away),field:text(cols.field),location:text(cols.location),
    referees:(explicitRefs?cols.referees:officials.slice(0,2)).map(text).filter(Boolean),
    table:(explicitTable?cols.table:officials.slice(2)).map(text).filter(Boolean)
  };
}
function splitMatch(v){
  const s=text(v),m=s.match(/(?:\s+|-)?\b(?:vs\.?|tegen)\b(?:\s+|-)?/i);if(!m)return null;
  const i=m.index;return[cleanTeam(s.slice(0,i)),cleanTeam(s.slice(i+m[0].length))];
}

async function loadXlsx(){
  if(window.XLSX)return;
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=resolve;s.onerror=()=>reject(Error('Excel-parser kon niet worden geladen.'));document.head.appendChild(s)});
}
function excelHeaderInfo(row){
  const cells=row.map(v=>text(v)),roles={date:[],arrival:[],start:[],home:[],away:[],team:[],field:[],location:[],officials:[],referee:[],table:[]};
  cells.forEach((v,i)=>Object.keys(roles).forEach(k=>{if(isHeader(v,k))roles[k].push(i)}));
  if(!roles.start.length&&roles.arrival.length===1){const n=norm(cells[roles.arrival[0]]);if(n==='aanvang'||n==='tijd'){roles.start=[roles.arrival[0]];roles.arrival=[]}}
  const score=(roles.date.length?3:0)+(roles.start.length?3:0)+(roles.arrival.length?1:0)+(roles.field.length?1:0)+(roles.location.length?1:0)+(roles.officials.length||roles.referee.length||roles.table.length?1:0)+(roles.home.length&&roles.away.length?3:Math.min(roles.team.length,2));
  return{cells,roles,score};
}
function excelTeams(row,info){
  const r=info.roles;
  if(r.home.length&&r.away.length)return[cleanTeam(row[r.home[0]]),cleanTeam(row[r.away[0]])];
  if(r.team.length>=2)return[cleanTeam(row[r.team[0]]),cleanTeam(row[r.team[1]])];
  const matchStart=Math.min(...[...r.team,...r.home,...r.away].filter(Number.isFinite));
  const stops=[...r.field,...r.location,...r.officials,...r.referee,...r.table].filter(Number.isFinite),stop=stops.length?Math.min(...stops):row.length;
  const start=Number.isFinite(matchStart)?matchStart:Math.max(0,(r.start[0]??r.arrival[0]??0)+1),joined=row.slice(start,stop).map(text).filter(Boolean).join(' '),pair=splitMatch(joined);
  return pair||['',''];
}
function excelOfficials(row,info){
  const r=info.roles;
  if(r.referee.length||r.table.length)return{referees:r.referee.map(i=>text(row[i])).filter(Boolean),table:r.table.map(i=>text(row[i])).filter(Boolean)};
  if(r.officials.length){const start=Math.min(...r.officials);return{officials:row.slice(start).map(text).filter(Boolean)}}
  return{officials:[]};
}
async function parseExcel(file){
  await loadXlsx();
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true}),out=[];
  for(const sheetName of wb.SheetNames){
    const sh=wb.Sheets[sheetName],rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:'',raw:true});
    if(!rows.length)continue;
    let best=null;
    for(let i=0;i<Math.min(rows.length,60);i++){const info=excelHeaderInfo(rows[i]);if(!best||info.score>best.info.score)best={index:i,info};}
    if(!best||best.info.score<6)continue;
    const info=best.info,r=info.roles,di=r.date[0],ai=r.arrival[0],si=r.start[0];
    let lastDate='';
    for(const row of rows.slice(best.index+1)){
      const teams=excelTeams(row,info);if(!teams[0]||!teams[1])continue;
      let date=normalizeDate(row[di]);if(date)lastDate=date;else date=lastDate;
      const start=normalizeTime(row[si]);if(!date||!start)continue;
      const off=excelOfficials(row,info),item=makeRow({date,arrival:ai===undefined?'':row[ai],start,home:teams[0],away:teams[1],field:r.field.length?row[r.field[0]]:'',location:r.location.length?row[r.location[0]]:'',...off});
      if(item.date&&item.startTime&&item.home&&item.away)out.push(item);
    }
  }
  if(!out.length)throw Error('Geen taakregels in het Excel-bestand herkend. Controleer of kolomkoppen zoals Datum, Starttijd, Team/Thuis/Uit en eventueel Veld/Sporthal aanwezig zijn.');
  return out;
}

function wordParts(item){
  const s=text(item.text),matches=[...s.matchAll(/\S+/g)];if(matches.length<=1)return[{...item,text:s}];
  const x=Number(item.x)||0,w=Math.max(Number(item.w)||0,1),len=Math.max(s.length,1),out=[];
  for(const m of matches){const a=m.index,b=a+m[0].length;out.push({text:m[0],x:x+w*(a/len),y:item.y,w:Math.max(1,w*((b-a)/len))})}
  return out;
}
function groupRows(items,tolerance=3){
  const groups=[];
  for(const it of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){let g=groups.find(x=>Math.abs(x.y-it.y)<=tolerance);if(!g){g={y:it.y,items:[]};groups.push(g)}g.items.push(it)}
  return groups;
}
function nearestHeader(words,type,baseY){
  const hits=words.filter(w=>isHeader(w.text,type));if(!hits.length)return null;
  return hits.sort((a,b)=>Math.abs(a.y-baseY)-Math.abs(b.y-baseY)||a.x-b.x)[0];
}
function allHeaders(words,type,baseY,band=32){return words.filter(w=>isHeader(w.text,type)&&Math.abs(w.y-baseY)<=band).sort((a,b)=>a.x-b.x)}
function splitCombinedItem(item,bounds){
  const s=text(item.text),x=Number(item.x)||0,w=Math.max(Number(item.w)||0,1),end=x+w,cuts=(bounds||[]).filter(c=>Number.isFinite(c)&&c>x+1&&c<end-1).sort((a,b)=>a-b);
  if(!s||!cuts.length)return[{...item,text:s}];
  const spaces=[...s.matchAll(/\s+/g)].map(m=>m.index+m[0].length).filter(i=>i>0&&i<s.length),picked=[];let last=0;
  for(const cut of cuts){const rough=Math.round(((cut-x)/w)*s.length),candidates=spaces.filter(i=>i>last+1&&i<s.length-1);let idx=candidates.length?candidates.reduce((best,i)=>Math.abs(i-rough)<Math.abs(best-rough)?i:best,candidates[0]):Math.max(last+1,Math.min(s.length-1,rough));if(idx<=last)continue;picked.push({idx,cut});last=idx}
  const out=[];let pos=0,px=x;
  for(const p of picked){const part=s.slice(pos,p.idx).trim();if(part)out.push({text:part,x:px,y:item.y,w:Math.max(1,p.cut-px)});pos=p.idx;px=p.cut}
  const tail=s.slice(pos).trim();if(tail)out.push({text:tail,x:px,y:item.y,w:Math.max(1,end-px)});return out;
}
function regexTokens(items,re){
  const out=[];
  items.forEach(it=>{const s=text(it.text),w=Math.max(Number(it.w)||0,1),x=Number(it.x)||0;for(const m of s.matchAll(re)){const len=Math.max(s.length,1);out.push({value:m[0],x:x+w*(m.index/len),order:0})}});
  return out.sort((a,b)=>a.x-b.x).map((v,i)=>({...v,order:i}));
}
function clusterXs(points,tolerance=11){
  const clusters=[];
  for(const p of points.sort((a,b)=>a.x-b.x)){
    let c=clusters.find(c=>Math.abs(c.x-p.x)<=tolerance);if(!c){c={x:p.x,n:0,rows:new Set()};clusters.push(c)}
    c.x=(c.x*c.n+p.x)/(c.n+1);c.n++;if(p.row!==undefined)c.rows.add(p.row);
  }
  return clusters;
}
function detectOfficialAnchors(dataGroups,offStart){
  if(!Number.isFinite(offStart))return[];
  const pts=[];
  dataGroups.forEach((g,row)=>{
    const frags=g.items.flatMap(it=>splitCombinedItem(it,[offStart])).filter(f=>f.x>=offStart-8).sort((a,b)=>a.x-b.x),starts=[];let end=null;
    for(const f of frags){if(end===null||f.x-end>11)starts.push(f.x);end=Math.max(end??-Infinity,f.x+Math.max(Number(f.w)||0,1))}
    starts.forEach(x=>pts.push({x,row}));
  });
  const minRows=Math.max(2,Math.ceil(dataGroups.length*.08)),clusters=clusterXs(pts).filter(c=>c.rows.size>=minRows).sort((a,b)=>a.x-b.x),anchors=[];
  for(const c of clusters){if(c.x<offStart-12)continue;if(anchors.every(x=>Math.abs(x-c.x)>20))anchors.push(c.x)}
  if(!anchors.length||Math.abs(anchors[0]-offStart)>18)anchors.unshift(offStart);
  return anchors;
}
function zoneText(items,min,max,bounds=[]){return text(items.flatMap(it=>splitCombinedItem(it,bounds)).filter(f=>f.x>=min&&f.x<max).sort((a,b)=>a.x-b.x).map(f=>f.text).join(' '))}
function officialNames(items,anchors,offStart,bounds=[]){
  if(!anchors.length)return[];
  const frags=items.flatMap(it=>splitCombinedItem(it,bounds)).filter(f=>f.x>=offStart-8).sort((a,b)=>a.x-b.x),cuts=[];
  for(let i=0;i<anchors.length-1;i++)cuts.push((anchors[i]+anchors[i+1])/2);
  const slots=Array.from({length:anchors.length},()=>[]);
  for(const f of frags){let slot=0;while(slot<cuts.length&&f.x>=cuts[slot])slot++;slots[slot].push(f.text)}
  return slots.map(s=>text(s.join(' '))).filter(Boolean);
}
async function parsePdf(file){
  const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p),tc=await page.getTextContent(),items=tc.items.map(i=>({text:text(i.str),x:Number(i.transform?.[4])||0,y:Number(i.transform?.[5])||0,w:Number(i.width)||0})).filter(i=>i.text),words=items.flatMap(wordParts);
    const dateHeads=words.filter(w=>isHeader(w.text,'date'));if(!dateHeads.length)continue;
    const dateHead=dateHeads.sort((a,b)=>{const sa=['arrival','start','team','home','away','field','location','officials','referee','table'].reduce((n,k)=>n+words.some(w=>isHeader(w.text,k)&&Math.abs(w.y-a.y)<=32),0),sb=['arrival','start','team','home','away','field','location','officials','referee','table'].reduce((n,k)=>n+words.some(w=>isHeader(w.text,k)&&Math.abs(w.y-b.y)<=32),0);return sb-sa})[0],hy=dateHead.y;
    let arrivalHead=nearestHeader(words,'arrival',hy),startHead=nearestHeader(words,'start',hy);
    if(!startHead&&arrivalHead){startHead=arrivalHead;arrivalHead=null}
    const fieldHead=nearestHeader(words,'field',hy),locHead=nearestHeader(words,'location',hy),officialHead=nearestHeader(words,'officials',hy),refHeads=allHeaders(words,'referee',hy),tableHeads=allHeaders(words,'table',hy),roleHeads=[...refHeads,...tableHeads].sort((a,b)=>a.x-b.x);
    const fieldStart=fieldHead?fieldHead.x-8:(locHead?locHead.x-8:(officialHead?officialHead.x-8:(roleHeads[0]?.x??Infinity))),locStart=locHead?locHead.x-8:(officialHead?officialHead.x-8:(roleHeads[0]?.x??Infinity)),offStart=officialHead?officialHead.x-6:(roleHeads.length?roleHeads[0].x-6:Infinity);
    if(!Number.isFinite(fieldStart))continue;
    const groups=groupRows(items),dataGroups=groups.filter(g=>/(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/.test(g.items.map(i=>i.text).join(' ')));
    let genericAnchors=[];if(Number.isFinite(offStart)&&!roleHeads.length)genericAnchors=detectOfficialAnchors(dataGroups,offStart);
    const roleAnchors=roleHeads.map(h=>({x:h.x,type:isHeader(h.text,'referee')?'referee':'table'}));
    for(const g of dataGroups){
      const its=[...g.items].sort((a,b)=>a.x-b.x),pre=zoneText(its,-Infinity,fieldStart,[fieldStart]),dateMatch=pre.match(/(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/),times=[...pre.matchAll(/(?<!\d)(\d{1,2})[:.](\d{2})(?!\d)/g)];
      if(!dateMatch||!times.length)continue;
      const timeTokens=regexTokens(its.filter(i=>i.x<fieldStart),/(?<!\d)\d{1,2}[:.]\d{2}(?!\d)/g);let arrival='',start='',startOrder=times.length-1;
      if(startHead&&timeTokens.length){const st=timeTokens.reduce((best,t)=>Math.abs(t.x-startHead.x)<Math.abs(best.x-startHead.x)?t:best,timeTokens[0]);start=st.value;startOrder=st.order}else{start=times.length>=2?times[1][0]:times[0][0];startOrder=times.length>=2?1:0}
      if(arrivalHead&&timeTokens.length){const av=timeTokens.reduce((best,t)=>Math.abs(t.x-arrivalHead.x)<Math.abs(best.x-arrivalHead.x)?t:best,timeTokens[0]);if(av.order!==startOrder)arrival=av.value}else if(times.length>=2&&startOrder>0)arrival=times[0][0];
      const chosen=times[Math.min(startOrder,times.length-1)]||times[times.length-1],matchText=pre.slice((chosen.index??0)+chosen[0].length).trim(),pair=splitMatch(matchText);
      if(!pair?.[0]||!pair?.[1])continue;
      const allBounds=[fieldStart,locStart,offStart,...genericAnchors,...roleAnchors.map(a=>a.x)].filter(Number.isFinite),field=Number.isFinite(locStart)&&locStart>fieldStart?zoneText(its,fieldStart,locStart,allBounds):'',location=Number.isFinite(offStart)&&offStart>locStart?zoneText(its,locStart,offStart,allBounds):(Number.isFinite(locStart)?zoneText(its,locStart,Infinity,allBounds):'');
      let extra={officials:[]};
      if(roleAnchors.length){const sorted=roleAnchors.sort((a,b)=>a.x-b.x),names=officialNames(its,sorted.map(a=>a.x),offStart,allBounds),refs=[],table=[];names.forEach((n,i)=>{if(sorted[i]?.type==='referee')refs.push(n);else table.push(n)});extra={referees:refs,table}}
      else if(genericAnchors.length)extra={officials:officialNames(its,genericAnchors,offStart,allBounds)};
      const row=makeRow({date:dateMatch[0],arrival,start,home:pair[0],away:pair[1],field,location,...extra});if(row.date&&row.startTime&&row.home&&row.away)out.push(row);
    }
  }
  if(!out.length)throw Error('Geen taakregels in de PDF herkend. Controleer of de PDF tekst bevat en herkenbare kolomkoppen zoals Datum, Starttijd, Team/Thuis/Uit en Veld/Sporthal heeft.');
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
