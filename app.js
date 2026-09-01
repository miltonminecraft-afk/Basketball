(()=>{
  'use strict';

  const FEDERATION_ID='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
  const PUBLIC_API='https://api.foys.io/competition/public-api/v1';
  const FOYS_API='https://api.foys.io/foys/api';
  const DEFAULT_SELECTION={
    clubId:'a4a2e2fa-0635-46a5-8969-1d0fef40444f',
    clubName:'SV Argon',
    clubLogo:'https://images.foys.io/foys/a4a2e2fa-0635-46a5-8969-1d0fef40444f/CC586FA3B4D02C36D9D21FBE50E20E47.gif',
    teamId:50553,
    teamGuid:'9b807e1c-8acb-442f-8bb0-35d16bc76e78',
    teamName:'MSE-2',
    teamLogo:'https://images.foys.io/foys/a4a2e2fa-0635-46a5-8969-1d0fef40444f/CC586FA3B4D02C36D9D21FBE50E20E47.gif?w=200'
  };

  const STORE={
    selection:'basketballApp.selection.v3',
    person:'basketballApp.person.v3',
    cachePrefix:'basketballApp.matches.v3.',
    oldPerson:'basketballApp.selectedPerson.v1'
  };

  const $=id=>document.getElementById(id);
  const E={
    headerTeam:$('headerTeam'),headerSub:$('headerSub'),syncBtn:$('syncBtn'),teamSelect:$('teamSelect'),personSelect:$('personSelect'),
    sourceStatus:$('sourceStatus'),agendaList:$('agendaList'),gamesList:$('gamesList'),tasksList:$('tasksList'),gamesSubtitle:$('gamesSubtitle'),tasksSubtitle:$('tasksSubtitle'),
    teamModal:$('teamModal'),closeTeamModal:$('closeTeamModal'),clubSearch:$('clubSearch'),clubSearchBtn:$('clubSearchBtn'),clubSearchStatus:$('clubSearchStatus'),clubResults:$('clubResults'),chosenClub:$('chosenClub'),chosenClubLogo:$('chosenClubLogo'),chosenClubName:$('chosenClubName'),teamResults:$('teamResults'),
    calendarTeamLabel:$('calendarTeamLabel'),calendarTaskLabel:$('calendarTaskLabel'),taskCalendarHelp:$('taskCalendarHelp'),teamFeedUrl:$('teamFeedUrl'),taskFeedUrl:$('taskFeedUrl'),downloadIcsBtn:$('downloadIcsBtn'),
    settingsLogo:$('settingsLogo'),settingsClub:$('settingsClub'),settingsTeam:$('settingsTeam'),changeTeamBtn:$('changeTeamBtn'),seasonValue:$('seasonValue'),gameCountValue:$('gameCountValue'),updatedValue:$('updatedValue'),resetBtn:$('resetBtn'),toast:$('toast')
  };

  let selection=readJson(STORE.selection,null);
  const hadStoredSelection=!!selection?.teamGuid;
  if(!selection?.teamGuid) selection={...DEFAULT_SELECTION};

  let selectedPerson=localStorage.getItem(STORE.person)||localStorage.getItem(STORE.oldPerson)||'__all__';
  let currentClubTeams=[];
  let tasks=[];
  let matches=[];
  let updateMeta={mode:'loading',updatedAt:null,message:'Verbinden met Basketball.nl…'};
  let toastTimer=null;
  let searchTimer=null;

  function readJson(key,fallback){
    try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback}catch{return fallback}
  }
  function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
  function esc(value){
    return String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  }
  function unique(values){return [...new Set(values.filter(Boolean))]}
  function slug(value){
    return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'all';
  }
  function dateOnly(value){return String(value||'').slice(0,10)}
  function timeOnly(value){return String(value||'00:00').slice(0,5)}
  function eventKey(item,timeField='startTime'){return `${dateOnly(item.date)}T${timeOnly(item[timeField])}`}
  function formatDay(value){
    const d=new Date(`${dateOnly(value)}T12:00:00`);
    return new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(d).toUpperCase();
  }
  function formatUpdated(ts){
    if(!ts)return '—';
    return new Intl.DateTimeFormat('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ts));
  }
  function seasonRange(now=new Date()){
    const year=now.getFullYear();
    const startYear=now.getMonth()>=6?year:year-1;
    return {startYear,start:`${startYear}-07-01`,end:`${startYear+1}-06-30`,label:`${startYear}-${startYear+1}`};
  }
  function showToast(message){
    E.toast.textContent=message;
    E.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>E.toast.classList.remove('show'),2600);
  }
  async function fetchJson(url,options={}){
    const response=await fetch(url,{cache:'no-store',...options});
    if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }
  function apiHeaders(){return {'Accept':'application/json','X-FederationID':FEDERATION_ID}}

  function teamLabel(match,side){
    const sponsor=match[`${side}TeamSponsorClubName`];
    const organisation=match[`${side}Organisation`]?.name;
    const team=match[`${side}TeamName`]||'';
    return [sponsor||organisation,team].filter(Boolean).join(' ').trim()||'Onbekend team';
  }
  function statusLabel(status){
    const map={Planned:'Gepland',Final:'Eindstand',Cancelled:'Afgelast',Postponed:'Uitgesteld',InProgress:'Bezig',Played:'Gespeeld'};
    return map[status]||status||'Wedstrijd';
  }
  function hasScore(match){return match.homeScore!==null&&match.homeScore!==undefined&&match.awayScore!==null&&match.awayScore!==undefined}
  function isFinal(match){return match.status==='Final'||hasScore(match)&&dateOnly(match.date)<new Date().toISOString().slice(0,10)}
  function addressText(match){
    const a=match.address;
    if(!a)return '';
    const street=[a.address1,a.houseNumber,a.houseNumberExtension].filter(Boolean).join(' ');
    const city=[a.zipCode,a.city].filter(Boolean).join(' ');
    return [street,city].filter(Boolean).join(', ');
  }

  async function loadTasks(){
    try{
      const data=await fetchJson('./data/tasks.json');
      tasks=Array.isArray(data?.tasks)?data.tasks:[];
    }catch(error){
      console.error('Taken konden niet worden geladen',error);
      tasks=[];
      showToast('Takenschema kon niet worden geladen.');
    }
    if(selectedPerson!=='__all__'&&!people().includes(selectedPerson))selectedPerson='__all__';
    renderPersonSelector();
  }
  function people(){
    return unique(tasks.flatMap(task=>[...(task.referees||[]),...(task.table||[])])).sort((a,b)=>a.localeCompare(b,'nl'));
  }
  function renderPersonSelector(){
    E.personSelect.innerHTML=`<option value="__all__">Alle personen</option>`+people().map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
    E.personSelect.value=selectedPerson;
  }
  function taskVisible(task){return selectedPerson==='__all__'||task.referees?.includes(selectedPerson)||task.table?.includes(selectedPerson)}
  function taskRole(task,person=selectedPerson){
    const roles=[];
    if(task.referees?.includes(person))roles.push('Scheidsrechter');
    if(task.table?.includes(person))roles.push('Tafel');
    return roles.join(' + ');
  }

  async function searchClubs(query){
    const q=String(query||'').trim();
    if(q.length<2){E.clubSearchStatus.textContent='Typ minimaal 2 tekens.';E.clubResults.innerHTML='';return}
    E.clubSearchStatus.textContent='Zoeken…';
    E.clubResults.innerHTML='';
    try{
      const params=new URLSearchParams({quickSearch:q,maxResultCount:'30',skipCount:'0'});
      const data=await fetchJson(`${FOYS_API}/v2/pub/organisations/${FEDERATION_ID}/clubs?${params}`);
      const items=Array.isArray(data?.items)?data.items:[];
      E.clubSearchStatus.textContent=items.length?`${items.length} vereniging${items.length===1?'':'en'} gevonden`:'Geen verenigingen gevonden.';
      E.clubResults.innerHTML=items.map((club,index)=>{
        const city=club.address?.city||'';
        return `<button type="button" class="club-card" data-club-index="${index}">${club.logoUrl?`<img src="${esc(club.logoUrl)}?w=200" alt="">`:''}<div><strong>${esc(club.name)}</strong><span>${esc(city)}</span></div></button>`;
      }).join('');
      E.clubResults.querySelectorAll('[data-club-index]').forEach(button=>{
        button.addEventListener('click',()=>selectClub(items[Number(button.dataset.clubIndex)]));
      });
    }catch(error){
      console.error(error);
      E.clubSearchStatus.textContent='Zoeken mislukt. Controleer je internetverbinding.';
    }
  }

  async function selectClub(club){
    if(!club?.id)return;
    E.chosenClub.hidden=false;
    E.chosenClubName.textContent=club.name||'Vereniging';
    if(club.logoUrl){E.chosenClubLogo.src=`${club.logoUrl}?w=200`;E.chosenClubLogo.hidden=false}else E.chosenClubLogo.hidden=true;
    E.teamResults.innerHTML='<div class="empty">Teams laden…</div>';
    try{
      const teams=await fetchClubTeams(club.id);
      renderModalTeams(teams,{id:club.id,name:club.name,logoUrl:club.logoUrl||''});
    }catch(error){
      console.error(error);
      E.teamResults.innerHTML='<div class="empty error-box">Teams konden niet worden opgehaald.</div>';
    }
  }

  async function fetchClubTeams(clubId){
    const data=await fetchJson(`${PUBLIC_API}/organisations/${encodeURIComponent(clubId)}/teams`,{headers:apiHeaders()});
    return Array.isArray(data)?data:[];
  }
  function renderModalTeams(teams,club){
    if(!teams.length){E.teamResults.innerHTML='<div class="empty">Voor deze vereniging zijn geen teams gevonden.</div>';return}
    E.teamResults.innerHTML=teams.map((team,index)=>{
      const selected=team.guid===selection.teamGuid;
      return `<button type="button" class="team-card${selected?' selected':''}" data-team-index="${index}">${team.logoUrl?`<img src="${esc(team.logoUrl)}" alt="" style="width:34px;height:34px;object-fit:contain">`:''}<div><strong>${esc(team.name)}</strong><span>${esc(team.organisationName||club.name)}</span></div>${selected?'<span class="team-check">✓</span>':''}</button>`;
    }).join('');
    E.teamResults.querySelectorAll('[data-team-index]').forEach(button=>{
      button.addEventListener('click',()=>applyTeamSelection(club,teams[Number(button.dataset.teamIndex)]));
    });
  }

  async function loadCurrentClubTeams(){
    try{
      currentClubTeams=await fetchClubTeams(selection.clubId);
      const stillThere=currentClubTeams.find(team=>team.guid===selection.teamGuid);
      if(stillThere){
        selection={...selection,teamId:stillThere.id,teamName:stillThere.name,teamLogo:stillThere.logoUrl||selection.teamLogo};
        writeJson(STORE.selection,selection);
      }
    }catch(error){
      console.warn('Teamlijst niet beschikbaar',error);
      currentClubTeams=[];
    }
    renderTeamSelector();
  }

  function renderTeamSelector(){
    const list=currentClubTeams.length?currentClubTeams:[{id:selection.teamId,guid:selection.teamGuid,name:selection.teamName,organisationName:selection.clubName,logoUrl:selection.teamLogo}];
    E.teamSelect.innerHTML=list.map(team=>`<option value="${esc(team.guid)}">${esc(team.name)}</option>`).join('')+'<option value="__change_club__">Andere vereniging zoeken…</option>';
    E.teamSelect.value=selection.teamGuid;
  }

  async function applyTeamSelection(club,team){
    selection={
      clubId:club.id,
      clubName:club.name||team.organisationName||'Vereniging',
      clubLogo:club.logoUrl||team.logoUrl||'',
      teamId:team.id,
      teamGuid:team.guid,
      teamName:team.name,
      teamLogo:team.logoUrl||club.logoUrl||''
    };
    writeJson(STORE.selection,selection);
    currentClubTeams=[];
    closeTeamModal();
    await loadCurrentClubTeams();
    await syncMatches();
    showToast(`${selection.clubName} ${selection.teamName} geselecteerd.`);
  }

  function openTeamModal(){
    E.teamModal.classList.add('open');
    E.teamModal.setAttribute('aria-hidden','false');
    E.clubResults.innerHTML='';
    E.clubSearchStatus.textContent='';
    E.clubSearch.value=selection.clubName||'';
    const currentClub={id:selection.clubId,name:selection.clubName,logoUrl:selection.clubLogo};
    E.chosenClub.hidden=false;
    E.chosenClubName.textContent=selection.clubName;
    if(selection.clubLogo){E.chosenClubLogo.src=selection.clubLogo;E.chosenClubLogo.hidden=false}else E.chosenClubLogo.hidden=true;
    if(currentClubTeams.length)renderModalTeams(currentClubTeams,currentClub);
    else selectClub(currentClub);
    setTimeout(()=>E.clubSearch.focus(),100);
  }
  function closeTeamModal(){E.teamModal.classList.remove('open');E.teamModal.setAttribute('aria-hidden','true')}

  async function syncMatches(){
    const range=seasonRange();
    const cacheKey=STORE.cachePrefix+selection.teamGuid;
    E.syncBtn.disabled=true;
    E.syncBtn.textContent='Laden…';
    updateMeta={...updateMeta,mode:'loading',message:'Live gegevens ophalen…'};
    renderStatus();
    try{
      const collected=[];
      let skip=0,total=Infinity;
      const pageSize=100;
      while(skip<total){
        const params=new URLSearchParams({startDate:range.start,endDate:range.end,teamGuid:selection.teamGuid,skipCount:String(skip),maxResultCount:String(pageSize),sorting:'date asc, startTime asc'});
        const data=await fetchJson(`${PUBLIC_API}/matches?${params}`,{headers:apiHeaders()});
        const items=Array.isArray(data?.items)?data.items:[];
        total=Number.isFinite(Number(data?.totalCount))?Number(data.totalCount):items.length;
        collected.push(...items);
        skip+=items.length;
        if(!items.length||items.length<pageSize)break;
      }
      matches=collected.sort((a,b)=>eventKey(a).localeCompare(eventKey(b)));
      const updatedAt=Date.now();
      writeJson(cacheKey,{updatedAt,matches});
      updateMeta={mode:'online',updatedAt,message:`Online · ${matches.length} wedstrijden`};
    }catch(error){
      console.error('Live synchronisatie mislukt',error);
      const cached=readJson(cacheKey,null);
      if(cached?.matches){
        matches=cached.matches;
        updateMeta={mode:'offline',updatedAt:cached.updatedAt,message:'Offline · laatst opgeslagen programma'};
      }else{
        matches=[];
        updateMeta={mode:'error',updatedAt:null,message:'Online gegevens niet bereikbaar'};
      }
    }finally{
      E.syncBtn.disabled=false;
      E.syncBtn.textContent='Synchroniseren';
      renderAll();
    }
  }

  function gameCard(match){
    const final=isFinal(match);
    const cancelled=match.status==='Cancelled';
    const score=hasScore(match)?`${match.homeScore} – ${match.awayScore}`:'';
    const location=[match.accommodationName,match.fieldName].filter(Boolean).join(' · ');
    const address=addressText(match);
    const badgeClass=cancelled?'badge-cancelled':final?'badge-final':'badge-game';
    const badgeText=cancelled?'Afgelast':final?'Uitslag':'Wedstrijd';
    return `<article class="event" data-match-id="${esc(match.id)}"><div class="event-row"><div class="time-col">${final&&score?`<div class="event-time score">${esc(score)}</div><span class="event-status">Eindstand</span>`:`<div class="event-time">${esc(timeOnly(match.startTime))}</div><span class="event-status">${esc(statusLabel(match.status))}</span>`}</div><div class="event-main"><span class="badge ${badgeClass}">${badgeText}</span><div class="match-title">${esc(teamLabel(match,'home'))} — ${esc(teamLabel(match,'away'))}</div>${final&&score?`<div class="score-line">${esc(score)}</div>`:''}<div class="meta">${esc(location||'Locatie nog niet bekend')}${address?`<br>${esc(address)}`:''}</div><div class="competition">${esc(match.competition?.name||'')} · wedstrijd-ID ${esc(match.id)}</div></div></div></article>`;
  }

  function taskCard(task){
    const role=selectedPerson==='__all__'?'':taskRole(task);
    return `<article class="event" data-task-id="${esc(task.id)}"><div class="event-row"><div class="time-col"><div class="event-time">${esc(task.arrivalTime)}</div><span class="event-status">Aanwezig</span></div><div class="event-main"><span class="badge badge-task">Taak</span><div class="match-title">${esc(task.home)} — ${esc(task.away)}</div><div class="meta">Wedstrijd ${esc(task.startTime)} · ${esc(task.location)}${task.field?` · ${esc(task.field)}`:''}</div><div class="officials">${selectedPerson==='__all__'?`<b>Scheidsrechters:</b> ${esc(unique(task.referees||[]).join(', '))}<br><b>Tafel:</b> ${esc(unique(task.table||[]).join(', '))}`:`<b>Jouw taak:</b> ${esc(role||'—')}`}</div></div></div></article>`;
  }

  function grouped(items,renderer,timeField='startTime'){
    if(!items.length)return '<div class="empty">Geen items voor deze selectie.</div>';
    const map=new Map();
    items.forEach(item=>{const d=dateOnly(item.date);if(!map.has(d))map.set(d,[]);map.get(d).push(item)});
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,rows])=>`<section class="day"><div class="day-head">${esc(formatDay(date))}</div>${rows.sort((a,b)=>eventKey(a,timeField).localeCompare(eventKey(b,timeField))).map(renderer).join('')}</section>`).join('');
  }

  function renderStatus(){
    const cls=updateMeta.mode==='online'?'status-online':updateMeta.mode==='offline'?'status-offline':updateMeta.mode==='error'?'status-error':'status-loading';
    E.sourceStatus.className=`status-card ${cls}`;
    E.sourceStatus.innerHTML=`<span>Wedstrijdbron</span><strong>${esc(updateMeta.message)}${updateMeta.updatedAt?` · ${esc(formatUpdated(updateMeta.updatedAt))}`:''}</strong>`;
  }

  function renderAll(){
    const visibleTasks=tasks.filter(taskVisible).sort((a,b)=>eventKey(a,'arrivalTime').localeCompare(eventKey(b,'arrivalTime')));
    const sortedMatches=[...matches].sort((a,b)=>eventKey(a).localeCompare(eventKey(b)));
    const agenda=[
      ...sortedMatches.map(item=>({...item,__kind:'game',__sortTime:item.startTime})),
      ...visibleTasks.map(item=>({...item,__kind:'task',__sortTime:item.arrivalTime}))
    ].sort((a,b)=>`${dateOnly(a.date)}T${a.__sortTime}`.localeCompare(`${dateOnly(b.date)}T${b.__sortTime}`));

    E.headerTeam.textContent=`${selection.clubName} ${selection.teamName}`;
    E.headerSub.textContent=selectedPerson==='__all__'?'Alle taken zichtbaar':`Taken van ${selectedPerson}`;
    E.gamesSubtitle.textContent=`${selection.clubName} ${selection.teamName} · ${seasonRange().label}`;
    E.tasksSubtitle.textContent=selectedPerson==='__all__'?'Alle personen uit het takenschema.':`Alleen taken van ${selectedPerson}.`;
    E.gamesList.innerHTML=grouped(sortedMatches,gameCard);
    E.tasksList.innerHTML=grouped(visibleTasks,taskCard,'arrivalTime');
    E.agendaList.innerHTML=grouped(agenda,item=>item.__kind==='game'?gameCard(item):taskCard(item),'__sortTime');
    renderStatus();
    renderSettings();
    renderCalendarLinks();
  }

  function renderSettings(){
    E.settingsClub.textContent=selection.clubName;
    E.settingsTeam.textContent=selection.teamName;
    const logo=selection.teamLogo||selection.clubLogo;
    if(logo){E.settingsLogo.src=logo;E.settingsLogo.hidden=false}else E.settingsLogo.hidden=true;
    E.seasonValue.textContent=seasonRange().label;
    E.gameCountValue.textContent=String(matches.length);
    E.updatedValue.textContent=updateMeta.updatedAt?formatUpdated(updateMeta.updatedAt):'—';
  }

  function appRoot(){return new URL('./',document.baseURI)}
  function teamFeed(){return new URL(`cal/teams/${encodeURIComponent(selection.teamGuid)}.ics`,appRoot()).href}
  function taskFeed(){return new URL(`cal/tasks/${selectedPerson==='__all__'?'all':slug(selectedPerson)}.ics`,appRoot()).href}
  function renderCalendarLinks(){
    const tf=teamFeed(),pf=taskFeed();
    E.calendarTeamLabel.textContent=`${selection.clubName} ${selection.teamName}`;
    E.calendarTaskLabel.textContent=selectedPerson==='__all__'?'Alle personen':selectedPerson;
    E.taskCalendarHelp.textContent=selectedPerson==='__all__'?'Deze link bevat het volledige takenschema van alle personen. Kies bovenaan een persoon als je alleen diens taken wilt koppelen.':`Deze abonnementslink bevat alleen de scheidsrechter- en tafeltaken van ${selectedPerson}.`;
    E.teamFeedUrl.textContent=tf;
    E.taskFeedUrl.textContent=pf;
  }

  async function copyText(text){
    try{await navigator.clipboard.writeText(text);return true}catch{
      const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return ok;
    }
  }
  async function providerAction(feedKind,provider){
    const url=feedKind==='team'?teamFeed():taskFeed();
    if(provider==='copy'){
      await copyText(url);showToast('Agenda-link gekopieerd.');return;
    }
    if(provider==='webcal'){
      location.href=url.replace(/^https:/i,'webcal:');return;
    }
    await copyText(url);
    if(provider==='google'){
      showToast('Link gekopieerd. Plak hem in Google Agenda bij “Via URL”.');
      window.open('https://calendar.google.com/calendar/u/0/r/settings/addbyurl','_blank','noopener');
      return;
    }
    if(provider==='outlook'){
      showToast('Link gekopieerd. Kies in Outlook “Abonneren via internet”.');
      window.open('https://outlook.live.com/calendar/0/addcalendar','_blank','noopener');
    }
  }

  function icsEscape(value){return String(value??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
  function taskSummary(task){
    if(selectedPerson==='__all__')return `Taak: ${task.home} - ${task.away}`;
    return `${taskRole(task)||'Taak'}: ${task.home} - ${task.away}`;
  }
  function combinedIcs(){
    const now=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Basketball Agenda//NL','CALSCALE:GREGORIAN','METHOD:PUBLISH',`X-WR-CALNAME:${icsEscape(`${selection.clubName} ${selection.teamName} + taken`)}`,'X-WR-TIMEZONE:Europe/Amsterdam'];
    for(const match of matches){
      const score=hasScore(match)?`${match.homeScore}-${match.awayScore}`:'';
      const summary=isFinal(match)&&score?`${teamLabel(match,'home')} ${score} ${teamLabel(match,'away')}`:`${teamLabel(match,'home')} - ${teamLabel(match,'away')}`;
      const desc=[match.competition?.name,statusLabel(match.status),score?`Uitslag: ${score}`:'',`Wedstrijd-ID: ${match.id}`].filter(Boolean).join('\\n');
      lines.push('BEGIN:VEVENT',`UID:foys-match-${match.id}@basketball-agenda`,`DTSTAMP:${now}`,`DTSTART;TZID=Europe/Amsterdam:${dateOnly(match.date).replaceAll('-','')}T${timeOnly(match.startTime).replace(':','')}00`,'DURATION:PT2H',`SUMMARY:${icsEscape(summary)}`,`DESCRIPTION:${icsEscape(desc)}`,`LOCATION:${icsEscape([match.accommodationName,addressText(match)].filter(Boolean).join(', '))}`,'END:VEVENT');
    }
    for(const task of tasks.filter(taskVisible)){
      const role=selectedPerson==='__all__'?`Scheidsrechters: ${unique(task.referees||[]).join(', ')}; Tafel: ${unique(task.table||[]).join(', ')}`:`Jouw taak: ${taskRole(task)}`;
      lines.push('BEGIN:VEVENT',`UID:argon-${task.id}-${selectedPerson==='__all__'?'all':slug(selectedPerson)}@basketball-agenda`,`DTSTAMP:${now}`,`DTSTART;TZID=Europe/Amsterdam:${task.date.replaceAll('-','')}T${task.arrivalTime.replace(':','')}00`,'DURATION:PT2H30M',`SUMMARY:${icsEscape(taskSummary(task))}`,`DESCRIPTION:${icsEscape(`Wedstrijd ${task.startTime}\\n${role}`)}`,`LOCATION:${icsEscape([task.location,task.field].filter(Boolean).join(', '))}`,'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n')+'\r\n';
  }
  function downloadCombinedIcs(){
    const blob=new Blob([combinedIcs()],{type:'text/calendar;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=`basketball-${slug(selection.clubName+'-'+selection.teamName)}-${selectedPerson==='__all__'?'alle-taken':slug(selectedPerson)}.ics`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function switchView(name){
    document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view.id===`view-${name}`));
    document.querySelectorAll('.tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.view===name));
  }

  E.syncBtn.addEventListener('click',syncMatches);
  E.personSelect.addEventListener('change',()=>{
    selectedPerson=E.personSelect.value;
    localStorage.setItem(STORE.person,selectedPerson);
    renderAll();
  });
  E.teamSelect.addEventListener('change',async()=>{
    if(E.teamSelect.value==='__change_club__'){E.teamSelect.value=selection.teamGuid;openTeamModal();return}
    const team=currentClubTeams.find(item=>item.guid===E.teamSelect.value);
    if(!team)return;
    await applyTeamSelection({id:selection.clubId,name:selection.clubName,logoUrl:selection.clubLogo},team);
  });
  E.changeTeamBtn.addEventListener('click',openTeamModal);
  E.closeTeamModal.addEventListener('click',closeTeamModal);
  E.teamModal.addEventListener('click',event=>{if(event.target===E.teamModal)closeTeamModal()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&E.teamModal.classList.contains('open'))closeTeamModal()});
  E.clubSearchBtn.addEventListener('click',()=>searchClubs(E.clubSearch.value));
  E.clubSearch.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchClubs(E.clubSearch.value)}});
  E.clubSearch.addEventListener('input',()=>{
    clearTimeout(searchTimer);
    const q=E.clubSearch.value.trim();
    if(q.length>=3)searchTimer=setTimeout(()=>searchClubs(q),450);
  });
  document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>switchView(tab.dataset.view)));
  document.querySelectorAll('.provider-grid').forEach(grid=>{
    grid.querySelectorAll('[data-provider]').forEach(button=>button.addEventListener('click',()=>providerAction(grid.dataset.feed,button.dataset.provider)));
  });
  E.downloadIcsBtn.addEventListener('click',downloadCombinedIcs);
  E.resetBtn.addEventListener('click',()=>{
    if(!confirm('Teamkeuze, persoonskeuze en lokale wedstrijdcache wissen?'))return;
    Object.keys(localStorage).filter(key=>key.startsWith('basketballApp.')).forEach(key=>localStorage.removeItem(key));
    location.reload();
  });

  async function boot(){
    if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
    await loadTasks();
    renderPersonSelector();
    await loadCurrentClubTeams();
    renderAll();
    await syncMatches();
    if(!hadStoredSelection)openTeamModal();
  }

  boot();
})();
