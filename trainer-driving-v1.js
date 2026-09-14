(()=>{
'use strict';

document.addEventListener('change',e=>{
  if(e.target?.id!=='memberAdmin'||!e.target.checked)return;
  const trainer=document.getElementById('memberTrainer');
  if(trainer&&!trainer.checked){
    trainer.checked=true;
    trainer.dispatchEvent(new Event('change',{bubbles:true}));
  }
},true);

document.addEventListener('submit',e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='memberForm')return;
  const admin=document.getElementById('memberAdmin');
  const trainer=document.getElementById('memberTrainer');
  if(admin?.checked&&trainer)trainer.checked=true;
},true);
})();