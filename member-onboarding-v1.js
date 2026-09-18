(()=>{
'use strict';
const U='https://elpnfmlrkoemjrnzaeok.supabase.co',K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
let sb=null,busy=false,data=null,checked=false;
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
function toast(m){const e=document.getElementById('toast');if(!e)return alert(m);e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2800)}
async function client(){if(sb)return sb;const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});return sb}
function css(){
 if(document.getElementById('memberOnboardingCss'))return;
 const s=document.createElement('style');s.id='memberOnboardingCss';s.textContent=
 '.member-onboard-overlay[hidden]{display:none!important}.member-onboard-overlay{position:fixed;inset:0;z-index:2300;background:rgba(5,6,56,.56);display:flex;align-items:flex-end;justify-content:center}.member-onboard-sheet{width:min(100%,680px);max-height:90vh;overflow:auto;background:#fff;border-radius:28px 28px 0 0;padding:20px 22px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -12px 42px rgba(5,6,56,.22)}.member-onboard-head{display:flex;gap:12px;align-items:flex-start}.member-onboard-kicker{color:var(--muted,#747783);font-size:10px;font-weight:850}.member-onboard-title{margin:4px 0 0;color:var(--navy,#050638);font-size:22px}.member-onboard-copy{margin:12px 0;color:var(--muted,#747783);font-size:11px;line-height:1.5}.member-onboard-block{border-top:1px solid var(--line,#e4e5eb);padding-top:14px;margin-top:14px}.member-onboard-block h3{margin:0 0 9px;color:var(--navy,#050638);font-size:14px}.member-onboard-team{display:grid;grid-template-columns:minmax(0,1fr) 100px;gap:10px;align-items:center;margin:8px 0}.member-onboard-team span{font-weight:850;color:var(--navy,#050638);font-size:11px}.member-onboard-team input{width:100%;box-sizing:border-box;border:1px solid var(--line,#dfe1e8);border-radius:11px;padding:10px;background:#fff;color:var(--navy,#050638);font:inherit}.member-onboard-choice{display:grid;gap:8px}.member-onboard-choice label{display:flex;gap:9px;align-items:flex-start;border:1px solid var(--line,#e4e5eb);border-radius:12px;padding:11px;color:var(--navy,#050638);font-size:11px;font-weight:850}.member-onboard-choice small{display:block;margin-top:2px;color:var(--muted,#747783);font-size:9px;font-weight:650}.member-onboard-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.member-onboard-primary,.member-onboard-secondary{border:0;border-radius:12px;padding:11px 14px;font-weight:900}.member-onboard-primary{background:var(--navy,#050638);color:#fff}.member-onboard-secondary{background:#f1f2f6;color:var(--navy,#050638)}body.member-onboard-open{overflow:hidden}@media(min-width:700px){.member-onboard-overlay{align-items:center;padding:20px}.member-onboard-sheet{border-radius:24px;max-height:82vh}}';
 document.head.appendChild(s);
}
function overlay(){let o=document.getElementById('memberOnboardingOverlay');if(o)return o;o=document.createElement('div');o.id='memberOnboardingOverlay';o.className='member-onboard-overlay';o.hidden=true;o.innerHTML='<div class="member-onboard-sheet" role="dialog" aria-modal="true"><div id="memberOnboardingBody"></div></div>';document.body.appendChild(o);return o}
function close(){overlay().hidden=true;document.body.classList.remove('member-onboard-open')}
function open(){render();overlay().hidden=false;document.body.classList.add('member-onboard-open')}
function render(){
 const host=document.getElementById('memberOnboardingBody');if(!host||!data)return;
 const teams=Array.isArray(data.teams)?data.teams:[];
 let teamHtml='';
 for(const t of teams){teamHtml+='<label class="member-onboard-team"><span>'+esc(t.name)+'</span><input name="memberJersey" data-team-id="'+esc(t.id)+'" inputmode="numeric" autocomplete="off" placeholder="Nummer" value="'+esc(t.number||'')+'"></label>'}
 const teamBlock=teams.length?'<div class="member-onboard-block"><h3>Rugnummer</h3>'+teamHtml+'</div>':'';
 const teamChecked=data.visibility!=='club'?' checked':'',clubChecked=data.visibility==='club'?' checked':'';
 host.innerHTML='<div class="member-onboard-head"><div><span class="member-onboard-kicker">Eerste keer instellen</span><h2 class="member-onboard-title">'+esc(data.name||'Mijn spelersprofiel')+'</h2></div></div><p class="member-onboard-copy">Koppel je spelersprofiel aan de gegevens van de basketbalbond. Rugnummers worden per team opgeslagen en helpen ook bij bondsspeler-records die als private binnenkomen.</p><form id="memberOnboardingForm">'+teamBlock+'<div class="member-onboard-block"><h3>Wie mag mijn ledeninformatie zien?</h3><div class="member-onboard-choice"><label><input type="radio" name="memberVisibility" value="team"'+teamChecked+'><span>Alleen mijn team<small>Teamleden, gekoppelde trainers en admins.</small></span></label><label><input type="radio" name="memberVisibility" value="club"'+clubChecked+'><span>Hele club<small>Alleen ingelogde actieve clubleden. Nooit openbaar buiten de ledenomgeving.</small></span></label></div></div><div class="member-onboard-actions"><button class="member-onboard-primary" type="submit">Opslaan</button><button id="memberOnboardingLater" class="member-onboard-secondary" type="button">Later</button></div></form>';
 document.getElementById('memberOnboardingLater').onclick=close;
 document.getElementById('memberOnboardingForm').onsubmit=save;
}
async function save(e){
 e.preventDefault();if(busy)return;
 const inputs=[...document.querySelectorAll('[name="memberJersey"]')],numbers=inputs.map(i=>({teamId:i.dataset.teamId,number:String(i.value||'').trim()}));
 if(inputs.length&&!numbers.some(x=>x.number)){toast('Vul minimaal één rugnummer in, of kies Later.');return}
 const visibility=document.querySelector('[name="memberVisibility"]:checked')?.value||'team';busy=true;
 try{const s=await client(),r=await s.rpc('save_member_onboarding',{p_visibility:visibility,p_numbers:numbers});if(r.error)throw r.error;data=r.data;close();toast('Spelersprofiel opgeslagen.');document.dispatchEvent(new CustomEvent('basketball-member-onboarding-saved',{detail:data}))}
 catch(err){toast(err?.message||'Opslaan mislukt.')}finally{busy=false}
}
async function check(force=false){
 if(checked&&!force)return;
 try{const s=await client(),ses=await s.auth.getSession();if(!ses.data.session)return;const me=await s.rpc('sync_current_member');if(me.error||!me.data?.active)return;const r=await s.rpc('get_member_onboarding');if(r.error)throw r.error;data=r.data;checked=true;if(data?.privacyConfirmed!==true)open()}
 catch(e){console.warn('Spelersprofiel laden',e)}
}
function init(){css();overlay();setTimeout(()=>check(false),2100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();