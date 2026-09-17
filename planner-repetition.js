/* Repeating plans: generated daily stages keep compatibility with existing sync and widgets. */
(function(root){
  'use strict';
  const isRepeat=p=>p.type==='repeat';
  function daysBetween(start,end){
    function parse(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))throw Error('請填完整日期。');const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s)throw Error('日期無效。');return +d;}
    const a=parse(start),b=parse(end),n=(b-a)/86400000+1;
    if(n<1)throw Error('截止日期不能早於開始日期。');
    if(n>3660)throw Error('請將單一計畫控制在 10 年內。');
    return Array.from({length:n},(_,i)=>new Date(a+i*86400000).toISOString().slice(0,10));
  }
  function progress(p){const done=(p.stages||[]).filter(s=>s.done).reduce((n,s)=>n+(Number.isSafeInteger(s.quantity)&&s.quantity>0?s.quantity:0),0);return {done,remaining:Math.max(0,p.targetTotal-done),percent:p.targetTotal>0?Math.min(100,done/p.targetTotal*100):0};}
  function schedule(p,oldStages=[]){
    const dates=daysBetween(p.startDate,p.endDate),total=Number(p.targetTotal);
    if(!Number.isSafeInteger(total)||total<1)throw Error('目標總數請填大於 0 的整數。');
    const completed=oldStages.filter(s=>s.done);
    if(completed.some(s=>!dates.includes(s.targetDate)))throw Error('新的日期範圍需包含已完成的日期。');
    const done=completed.reduce((n,s)=>n+s.quantity,0);
    if(!Number.isSafeInteger(done)||done>total)throw Error('目標總數不能少於已完成回數。');
    const locked=new Map(completed.map(s=>[s.targetDate,s])),old=new Map(oldStages.map(s=>[s.targetDate,s]));
    const available=dates.filter(d=>!locked.has(d)),remaining=total-done;
    if(!available.length&&remaining)throw Error('所有日期已完成，請延長截止日期以安排新增回數。');
    const base=available.length?Math.floor(remaining/available.length):0,extra=available.length?remaining%available.length:0;
    let i=0;
    return dates.flatMap(d=>{
      if(locked.has(d))return [{...locked.get(d),title:p.title+'｜'+locked.get(d).quantity+' 回'}];
      const quantity=base+(i++<extra?1:0);if(!quantity)return [];
      const previous=old.get(d);
      return [{...(previous||{}),id:previous?.id||p.id+'-'+d,title:p.title+'｜'+quantity+' 回',targetDate:d,quantity,done:false}];
    });
  }
  root.PlannerRepetition={schedule,progress,daysBetween};
  if(typeof document==='undefined')return;
  const $=s=>document.querySelector(s),host=$('#longPlanView');if(!host)return;
  let mode='stage',editingRepeat=false;
  const css=document.createElement('style');css.textContent=`#repeatModes{display:flex;gap:6px;background:#e9edf3;border-radius:14px;padding:5px;margin-bottom:18px}#repeatModes button{flex:1;border:0;border-radius:10px;padding:12px;font:inherit;font-weight:650;background:transparent;color:#526079;cursor:pointer}#repeatModes button[aria-selected=true]{background:white;color:#1d4ed8}#longPlanList .plan-card[hidden]{display:none!important}.repeat-track{height:16px;border-radius:20px;overflow:hidden;background:#e2e8f0;margin:20px 0 10px}.repeat-fill{height:100%;background:var(--plan-color);border-radius:20px}.repeat-count{font-size:1rem;font-weight:650}.repeat-tip{font-size:.85rem;line-height:1.6;color:#64748b}.repeat-option{display:flex!important;align-items:center;gap:10px}.repeat-option input{width:20px!important;height:20px}#repeatFields[hidden]{display:none!important}#repeatFields input[type=number]{width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px}#repeatModeEmpty{padding:25px;background:white;border-radius:18px;text-align:center}#repeatModes button:focus-visible{outline:3px solid #93c5fd}`;document.head.append(css);
  const tabs=document.createElement('div');tabs.id='repeatModes';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','計畫類型');tabs.innerHTML='<button id="stageMode" type="button" role="tab" aria-selected="true">階段計畫</button><button id="repeatMode" type="button" role="tab" aria-selected="false" tabindex="-1">重複性計畫</button>';
  $('#longPlanList').before(tabs);
  const fields=document.createElement('div');fields.id='repeatFields';fields.hidden=true;fields.innerHTML='<label>目標總數（回）<input id="repeatTotal" type="number" min="1" step="1" inputmode="numeric" placeholder="例如：40"></label><label class="repeat-option" style="margin-top:16px"><input id="repeatVisible" type="checkbox" checked>顯示在月曆、週檢視與每日清單</label><p class="repeat-tip" id="repeatAllocation">開始日與截止日皆計入天數；每天勾選後累計當日回數。</p>';
  $('#longPlanError').before(fields);
  const originalRender=renderLongPlans,originalOpen=openLongPlanDialog,originalSubmit=$('#longPlanForm').onsubmit;
  function choose(next){mode=next;for(const [id,value] of [['stageMode','stage'],['repeatMode','repeat']]){const b=$('#'+id);b.setAttribute('aria-selected',String(mode===value));b.tabIndex=mode===value?0:-1;}renderLongPlans();}
  $('#stageMode').onclick=()=>choose('stage');$('#repeatMode').onclick=()=>choose('repeat');
  tabs.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();choose(e.key==='Home'?'stage':e.key==='End'?'repeat':mode==='stage'?'repeat':'stage');$(mode==='stage'?'#stageMode':'#repeatMode').focus();}};
  renderLongPlans=function(){
    originalRender();
    let visible=0;
    for(const card of $('#longPlanList').querySelectorAll('.plan-card')){
      const p=longPlans.find(x=>x.id===card.dataset.planCard);if(!p)continue;
      card.hidden=isRepeat(p)!==(mode==='repeat');if(!card.hidden)visible++;
      if(!isRepeat(p))continue;
      const v=progress(p),top=card.querySelector('.plan-top'),note=card.querySelector('.plan-note');
      card.replaceChildren(top);if(note)card.append(note);
      const track=document.createElement('div');track.className='repeat-track';track.setAttribute('role','progressbar');track.setAttribute('aria-label',p.title+'完成回數');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(p.targetTotal));track.setAttribute('aria-valuenow',String(v.done));
      const fill=document.createElement('div');fill.className='repeat-fill';fill.style.width=v.percent+'%';track.append(fill);
      const count=document.createElement('div');count.className='repeat-count';count.textContent='已完成 '+v.done+' 回 · 剩餘 '+v.remaining+' 回';
      const tip=document.createElement('p');tip.className='repeat-tip';tip.textContent='目標 '+p.targetTotal+' 回 · '+daysBetween(p.startDate,p.endDate).length+' 天 · '+(p.showOnCalendar===false?'目前未顯示於日曆；編輯計畫可重新開啟。':'到每日清單勾選當天份量，進度會自動累計。');
      card.append(track,count,tip);
    }
    $('#longPlanList').querySelector('.long-empty-card')?.remove();
    if(!visible){const e=document.createElement('div');e.id='repeatModeEmpty';e.textContent=mode==='repeat'?'尚無重複性計畫，按「新增計畫」設定目標。':'尚無階段計畫，按「新增計畫」開始。';$('#longPlanList').append(e);}
  };
  function allocation(){if(!editingRepeat)return;try{const n=daysBetween($('#longPlanStart').value,$('#longPlanEnd').value).length,t=Number($('#repeatTotal').value);$('#repeatAllocation').textContent=Number.isSafeInteger(t)&&t>0?'共 '+n+' 天，平均每天約 '+(t/n).toLocaleString('zh-TW',{maximumSignificantDigits:5})+' 回；每日以整數分配。勾選當天即完成當天全部份量。':'請輸入目標總數。';}catch{$('#repeatAllocation').textContent='請填開始與截止日期。';}}
  openLongPlanDialog=function(id=null){originalOpen(id);const p=longPlans.find(x=>x.id===id);editingRepeat=p?isRepeat(p):mode==='repeat';fields.hidden=!editingRepeat;$('#repeatTotal').required=editingRepeat;$('#repeatTotal').value=p?.targetTotal||'';$('#repeatVisible').checked=p?.showOnCalendar!==false;if(editingRepeat)$('#longPlanDialogTitle').textContent=p?'編輯重複性計畫':'新增重複性計畫';allocation();};
  for(const id of ['repeatTotal','longPlanStart','longPlanEnd'])$('#'+id).addEventListener('input',allocation);
  $('#longPlanForm').onsubmit=e=>{
    if(!editingRepeat)return originalSubmit(e);
    e.preventDefault();const error=$('#longPlanError');
    try{
      const old=longPlans.find(p=>p.id===editingPlanId),title=$('#longPlanName').value.trim();if(!title)throw Error('請填計畫名稱。');
      const p={...(old||{}),id:old?.id||makeId(),type:'repeat',title,color:$('#longPlanColor').value,startDate:$('#longPlanStart').value,endDate:$('#longPlanEnd').value,note:$('#longPlanNote').value.trim(),targetTotal:Number($('#repeatTotal').value),showOnCalendar:$('#repeatVisible').checked};
      p.stages=schedule(p,old?.stages||[]);
      const next=old?longPlans.map(x=>x.id===p.id?p:x):[...longPlans,p];
      if(JSON.stringify({tasks,categories,events,longPlans:next}).length>45000)throw Error('每日排程超過目前雲端容量，請縮短期間或拆分資料儲存。');
      localStorage.setItem(longPlanKey,JSON.stringify(next));longPlans=next;closeLongPlanDialog();choose('repeat');render();renderWeek();renderPanel();showToast(old?'重複性計畫已更新':'重複性計畫已建立');
    }catch(ex){error.textContent=ex.message;}
  };
  const daily=PlannerAgenda.daily,month=PlannerBars.month;
  const visible=p=>!isRepeat(p)||p.showOnCalendar!==false;
  PlannerAgenda.daily=(tasks,plans,categories,date)=>daily(tasks,plans.filter(visible),categories,date);
  PlannerBars.month=(plans,year,m)=>month(plans.filter(visible),year,m);
  const panelRender=renderPanel;renderPanel=function(){panelRender();for(const b of document.querySelectorAll('[data-go-plan]')){const p=longPlans.find(x=>x.id===b.dataset.goPlan);if(p&&!visible(p))b.remove();}};
  document.addEventListener('click',e=>{const b=e.target.closest('[data-go-plan]');if(b){const p=longPlans.find(x=>x.id===b.dataset.goPlan);if(p)choose(isRepeat(p)?'repeat':'stage');}},true);
  renderLongPlans();render();renderWeek();renderPanel();
})(globalThis);
