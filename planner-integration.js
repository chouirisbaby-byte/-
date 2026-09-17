/* Calendar integration: derived views write changes back to the original records. */
(() => {
  const $=s=>document.querySelector(s);
  const attr=value=>escapeText(String(value??'')).replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const color=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:'#64748b';
  const daily=date=>PlannerAgenda.daily(tasks,longPlans,categories,date);
  const originalRender=render,originalPanel=renderPanel,originalWeek=renderWeek,originalPlans=renderLongPlans;
  const originalStageDialog=openStageDialog;
  let editingStageId=null,editingRow=null,returnFocus=null;
  const sourceLabel=row=>`${row.kind==='stage'?'計畫':'非計畫性'}・${row.sourceName}`;
  const rowAttrs=row=>`data-kind="${row.kind}" data-id="${attr(row.id)}" data-plan-id="${attr(row.planId)}"`;
  const warning=row=>row.overlap?'<span class="overlap-note">時間重疊</span>':'';

  function refreshViews(){render();renderWeek();renderPanel();renderLongPlans()}
  saveTasks=function(){localStorage.setItem(storageKey,JSON.stringify(tasks));refreshViews()};
  saveLongPlans=function(){localStorage.setItem(longPlanKey,JSON.stringify(longPlans));refreshViews()};

  render=function(){
    originalRender();
    const days=Array.from(grid.children),weeks=PlannerBars.month(longPlans,cursor.getFullYear(),cursor.getMonth());
    grid.replaceChildren();
    weeks.forEach((week,index)=>{
      const row=document.createElement('div');row.className='calendar-week';
      days.slice(index*7,index*7+7).forEach(day=>row.append(day));
      const bars=document.createElement('div');bars.className='plan-bars';bars.setAttribute('aria-hidden','true');
      week.segments.forEach(segment=>{
        const bar=document.createElement('div');bar.className='plan-bar';bar.textContent=`${segment.continuesBefore?'‹ ':''}${segment.title}${segment.continuesAfter?' ›':''}`;
        bar.style.gridColumn=`${segment.startColumn+1} / ${segment.endColumn+2}`;bar.style.gridRow=segment.lane+1;bar.style.background=color(segment.color);
        bars.append(bar);
      });
      if(week.hiddenCount){const more=document.createElement('span');more.className='plan-overflow';more.textContent=`+${week.hiddenCount} 個計畫`;bars.append(more)}
      row.append(bars);grid.append(row);
    });
  };

  renderPanel=function(){
    if(active==='important'){originalPanel();return}
    const rows=daily(selectedDate),plans=longPlans.filter(p=>p.startDate<=selectedDate&&p.endDate>=selectedDate);
    const planLinks=plans.length?`<div class="day-plans">${plans.map(p=>`<button class="source-link" data-go-plan="${attr(p.id)}"><i style="background:${color(p.color)}"></i>${escapeText(p.title)} ›</button>`).join('')}</div>`:'';
    body.innerHTML=planLinks+(rows.length?`<table class="agenda-table"><thead><tr><th scope="col">完成</th><th scope="col">時間</th><th scope="col">來源與內容</th></tr></thead><tbody>${rows.map(row=>`<tr data-agenda-row data-agenda-key="${attr(row.key)}" class="${row.overlap?'overlapping':''}"><td><button class="check ${row.done?'checked':''}" data-agenda-toggle="${row.kind}" ${rowAttrs(row)} aria-label="${row.done?'取消完成':'標示完成'}${attr(row.title)}" aria-pressed="${row.done}">${row.done?'✓':''}</button></td><td><button class="agenda-time" data-edit-${row.kind} ${rowAttrs(row)}>${row.startTime?`${row.startTime}<br>–${row.endTime}`:'未排時段'}</button>${warning(row)}</td><td><button class="agenda-content" data-edit-${row.kind} ${rowAttrs(row)}><span class="source-caption"><i style="background:${color(row.color)}"></i>${escapeText(sourceLabel(row))}</span><span class="agenda-name ${row.done?'completed':''}">${escapeText(row.title)}</span></button>${row.kind==='stage'?`<button class="source-link" data-go-plan="${attr(row.planId)}">前往計畫 ›</button>`:`<button class="delete agenda-delete" data-action="delete" data-id="${attr(row.id)}" aria-label="刪除非計畫性事件">×</button>`}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-state"><h3>目前沒有當日安排</h3><p>新增非計畫性事件，或在計畫規劃中加入這一天的階段。</p></div>');
  };

  renderWeek=function(){
    originalWeek();
    [...weekGrid.children].forEach(card=>{
      const key=card.querySelector('[data-week-date]').dataset.weekDate,rows=daily(key);card.dataset.weekDay=key;
      const block=card.querySelectorAll('.week-block')[1];
      function entries(list){return list.map(row=>`<button class="week-task ${row.done?'done':''} ${row.overlap?'overlapping':''}" data-week-date="${key}" data-agenda-key="${attr(row.key)}"><i class="week-task-line" style="background:${color(row.color)}"></i><span><span class="week-time">${row.done?'✓ 已完成 · ':''}${PlannerTime.timeLabel(row)}</span><span class="week-item-title">${escapeText(row.title)}</span><span class="week-item-sub">${escapeText(sourceLabel(row))}</span>${warning(row)}</span></button>`).join('')}
      const timed=rows.filter(r=>r.startTime),untimed=rows.filter(r=>!r.startTime);
      block.innerHTML=`<div class="week-block-title">今日安排 <span>${rows.filter(r=>r.done).length}/${rows.length}</span></div>${entries(timed)}${untimed.length?'<div class="week-block-title">未排時段</div>'+entries(untimed):''}${!rows.length?'<div class="week-empty">沒有當日安排</div>':''}`;
    });
  };

  renderLongPlans=function(){
    originalPlans();
    [...$('#longPlanList').querySelectorAll('.plan-card')].forEach(card=>{
      const planId=card.querySelector('[data-plan-id]').dataset.planId;card.dataset.planCard=planId;
      card.querySelectorAll('.stage-item').forEach(item=>{
        const stageId=item.querySelector('[data-stage-id]').dataset.stageId;
        const stage=longPlans.find(p=>p.id===planId)?.stages.find(s=>s.id===stageId);
        const edit=document.createElement('button');edit.className='stage-edit';edit.textContent='編輯';edit.dataset.longAction='edit-stage';edit.dataset.planId=planId;edit.dataset.stageId=stageId;edit.setAttribute('aria-label',`編輯${stage.title}`);
        item.insertBefore(edit,item.querySelector('.stage-delete'));
        if(stage.startTime)item.querySelector('.stage-date').append(` · ${PlannerTime.timeLabel(stage)}`);
      });
    });
  };

  function locate(kind,id,planId){return kind==='stage'?longPlans.find(p=>p.id===planId)?.stages?.find(s=>s.id===id):tasks.find(t=>t.id===id)}
  function persist(kind){kind==='stage'?saveLongPlans():saveTasks()}
  function goPlan(id){closeSheet();setMainView('long');const card=[...$('#longPlanList').children].find(c=>c.dataset.planCard===id);if(card){card.setAttribute('tabindex','-1');card.scrollIntoView({block:'center',behavior:'smooth'});card.focus({preventScroll:true})}}

  const backdrop=document.createElement('div');backdrop.className='category-backdrop';backdrop.id='agendaBackdrop';document.body.append(backdrop);
  const dialog=document.createElement('section');dialog.className='category-dialog';dialog.id='agendaDialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','agendaHeading');document.body.append(dialog);
  function closeAgenda(){dialog.classList.remove('show');backdrop.classList.remove('show');editingRow=null;if(returnFocus?.isConnected)returnFocus.focus()}
  function openAgendaEditor(kind,id,planId){
    const item=locate(kind,id,planId);if(!item){showToast('這個項目已不存在');refreshViews();return}
    editingRow={kind,id,planId};returnFocus=document.activeElement;
    dialog.innerHTML=`<header class="dialog-head"><h2 id="agendaHeading">${kind==='stage'?'安排階段時間':'編輯非計畫性事件'}</h2><button type="button" class="close-manager" id="closeAgenda" aria-label="關閉">×</button></header><form id="agendaEditor" class="plan-form">${kind==='task'?`<label>事件名稱<input id="agendaTitleInput" maxlength="60" required value="${attr(item.title)}"></label><label>事件類別<select id="agendaCategory">${categories.map(c=>`<option value="${attr(c.id)}" ${c.id===item.category?'selected':''}>${escapeText(c.name)}</option>`).join('')}${!categories.some(c=>c.id===item.category)?`<option selected value="${attr(item.category)}">未分類</option>`:''}</select></label>`:`<p class="agenda-stage-title">${escapeText(longPlans.find(p=>p.id===planId).title)} — ${escapeText(item.title)}</p><p class="manager-note">名稱與日期可在「計畫規劃」修改。</p>`}<div class="time-row"><label>開始時間<input id="agendaStartTime" type="time" value="${attr(item.startTime||'')}"></label><label>結束時間<input id="agendaEndTime" type="time" value="${attr(item.endTime||'')}"></label></div><button type="button" class="cancel" id="clearAgendaTime">清除時段</button><p class="form-error" role="alert" id="agendaError"></p><div class="dialog-actions"><button type="button" class="cancel" id="cancelAgenda">取消</button><button type="submit" class="save">儲存</button></div></form>`;
    dialog.classList.add('show');backdrop.classList.add('show');
    $('#closeAgenda').onclick=closeAgenda;$('#cancelAgenda').onclick=closeAgenda;
    $('#clearAgendaTime').onclick=()=>{$('#agendaStartTime').value='';$('#agendaEndTime').value='';$('#agendaError').textContent=''};
    $('#agendaEditor').onsubmit=e=>{
      e.preventDefault();if(!editingRow)return;const {kind,id,planId}=editingRow,item=locate(kind,id,planId);
      if(!item){closeAgenda();showToast('這個項目已不存在');refreshViews();return}
      const startTime=$('#agendaStartTime').value,endTime=$('#agendaEndTime').value;
      if(!PlannerTime.isValidTimeRange(startTime,endTime)){$('#agendaError').textContent='請填完整時段，結束時間須晚於開始時間（不跨日）。';return}
      if(kind==='task'){const name=$('#agendaTitleInput').value.trim();if(!name){$('#agendaError').textContent='請輸入事件名稱';return}item.title=name;item.category=$('#agendaCategory').value}
      item.startTime=startTime;item.endTime=endTime;closeAgenda();persist(kind);showToast('安排已更新');
    };
    (kind==='task'?$('#agendaTitleInput'):$('#agendaStartTime')).focus();
  }
  backdrop.onclick=closeAgenda;
  // Export the editor for the existing global page handlers and integration tests.
  window.openAgendaEditor=openAgendaEditor;
  body.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-go-plan')){goPlan(button.dataset.goPlan);return}
    const {kind,id,planId}=button.dataset;
    if(button.hasAttribute('data-agenda-toggle')){const item=locate(kind,id,planId);if(item){item.done=!item.done;persist(kind)}return}
    if(button.hasAttribute('data-edit-task')||button.hasAttribute('data-edit-stage'))openAgendaEditor(kind,id,planId);
  });
  weekGrid.addEventListener('click',e=>{
    const item=e.target.closest('[data-agenda-key]');if(!item)return;
    const row=[...body.querySelectorAll('[data-agenda-row]')].find(r=>r.dataset.agendaKey===item.dataset.agendaKey);
    row?.scrollIntoView({block:'center'});row?.querySelector('.agenda-content')?.focus();
  });

  openStageDialog=function(planId,stageId=null){
    originalStageDialog(planId);editingStageId=stageId;
    const plan=longPlans.find(p=>p.id===planId),stage=plan?.stages?.find(s=>s.id===stageId);
    $('#stageDialogTitle').textContent=stage?'編輯階段':'新增階段';
    $('#stageForm button[type="submit"]').textContent=stage?'儲存階段':'加入階段';
    $('#stageDate').min=plan.startDate;$('#stageDate').max=plan.endDate;
    if(stage){$('#stageName').value=stage.title;$('#stageDate').value=stage.targetDate}
  };
  $('#longPlanList').addEventListener('click',e=>{const b=e.target.closest('[data-long-action="edit-stage"]');if(b)openStageDialog(b.dataset.planId,b.dataset.stageId)});
  $('#stageForm').onsubmit=e=>{
    e.preventDefault();const plan=longPlans.find(p=>p.id===stagePlanId),title=$('#stageName').value.trim(),targetDate=$('#stageDate').value;
    if(!plan||!title||!targetDate)return;
    if(targetDate<plan.startDate||targetDate>plan.endDate){$('#stageError').textContent='階段日期需落在計畫的開始與目標日期之間。';return}
    if(editingStageId){const stage=plan.stages.find(s=>s.id===editingStageId);if(!stage){closeStageDialog();showToast('階段已不存在');return}Object.assign(stage,{title,targetDate})}
    else{if(!Array.isArray(plan.stages))plan.stages=[];plan.stages.push({id:makeId(),title,targetDate,done:false})}
    closeStageDialog();editingStageId=null;saveLongPlans();showToast('階段已儲存');
  };
  document.addEventListener('keydown',e=>{
    if(!dialog.classList.contains('show'))return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeAgenda()}
    if(e.key==='Tab'){const controls=[...dialog.querySelectorAll('button,input,select')],first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
  },true);
  refreshViews();
})();
