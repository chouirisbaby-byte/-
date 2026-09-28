/* Load last. Derived overdue indicators; no data or cloud writes. */
(function(root){
  'use strict';
  function localDay(d=new Date()){
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function validDay(day){
    if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
    const d=new Date(day+'T00:00:00Z');
    return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day;
  }
  function isOverdue(stage,today=localDay()){
    return !!stage&&!stage.done&&validDay(stage.targetDate)&&validDay(today)&&stage.targetDate<today;
  }
  if(root.PlannerOverdue)return;
  root.PlannerOverdue={localDay,isOverdue};
  if(typeof document==='undefined')return;
  const style=document.createElement('style');
  style.textContent=`.overdue-badge{display:inline-block;margin:3px 0 3px 6px;padding:2px 7px;border:1px solid #f6b6ab;border-radius:6px;background:#fff1ed;color:#9a291b;font-size:12px;font-weight:650;line-height:1.5;white-space:normal}.stage-item.is-overdue,.week-task.is-overdue{box-shadow:inset 3px 0 #c24132}.agenda-table tr.is-overdue>td:first-child{border-left:3px solid #c24132}.overdue-summary{margin:8px 0 0}`;
  document.head.append(style);
  function badge(parent,label='已逾期',summary=false){
    if(!parent)return;
    const el=document.createElement('span');el.className='overdue-badge'+(summary?' overdue-summary':'');el.textContent=label;parent.append(el);
  }
  function paint(){
    document.querySelectorAll('.overdue-badge').forEach(el=>el.remove());
    document.querySelectorAll('.is-overdue').forEach(el=>el.classList.remove('is-overdue'));
    const today=localDay(),plans=new Map(longPlans.map(p=>[p.id,p]));
    document.querySelectorAll('[data-plan-card]').forEach(card=>{
      const plan=plans.get(card.dataset.planCard);if(!plan)return;
      const stages=plan.stages||[],count=stages.filter(s=>isOverdue(s,today)).length;
      if(count)badge(card.querySelector('.plan-top')?.parentElement,`${count} 項${plan.type==='repeat'?'每日安排':'階段'}已逾期`,true);
      card.querySelectorAll('.stage-item').forEach(item=>{
        const id=item.querySelector('[data-stage-id]')?.dataset.stageId;
        if(isOverdue(stages.find(s=>s.id===id),today)){
          item.classList.add('is-overdue');badge(item.querySelector('.stage-date'));
        }
      });
    });
    document.querySelectorAll('[data-agenda-key]').forEach(item=>{
      let key;try{key=JSON.parse(item.dataset.agendaKey);}catch{return;}
      if(!Array.isArray(key)||key[0]!=='stage')return;
      const stage=plans.get(key[1])?.stages?.find(s=>s.id===key[2]);
      if(!isOverdue(stage,today))return;
      item.classList.add('is-overdue');badge(item.querySelector('.agenda-name,.week-item-title'));
    });
  }
  const oldPlans=renderLongPlans,oldPanel=renderPanel,oldWeek=renderWeek;
  renderLongPlans=function(...args){const result=oldPlans.apply(this,args);paint();return result;};
  renderPanel=function(...args){const result=oldPanel.apply(this,args);paint();return result;};
  renderWeek=function(...args){const result=oldWeek.apply(this,args);paint();return result;};
  root.PlannerOverdue.refresh=paint;
  let timer;
  function refreshClock(){
    clearTimeout(timer);paint();
    const now=new Date(),next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    timer=setTimeout(refreshClock,next.getTime()-now.getTime()+100);
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshClock();});
  root.addEventListener('focus',refreshClock);
  refreshClock();
})(globalThis);
