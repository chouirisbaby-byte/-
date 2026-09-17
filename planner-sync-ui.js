/* Loaded after planner-integration.js. No request runs until the user chooses an action. */
(() => {
  const $=s=>document.querySelector(s);
  const API_URL='https://script.google.com/macros/s/AKfycbyimSDhECapJoeJjN9F4vOrNXMBpM306wwElXg5IElVAhseB_e7RYsCUJMYH7xPirsjcQ/exec';
  const snapshot=()=>JSON.parse(JSON.stringify({tasks,categories,events,longPlans}));
  const overlay=document.createElement('div');overlay.id='syncBackdrop';overlay.className='category-backdrop';overlay.style.zIndex=10;
  const panel=document.createElement('section');panel.id='syncPanel';panel.className='category-dialog';panel.style.zIndex=11;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','syncTitle');
  panel.innerHTML='<header class="dialog-head"><h2 id="syncTitle">備份與同步</h2><button id="closeSync" class="close-manager" aria-label="關閉">×</button></header><div class="plan-form"><label>帳號名稱<input id="syncUser" maxlength="100" autocomplete="off"></label><p class="manager-note">沿用原帳號名稱。上傳會檢查版本；下載前保留本機備份。</p><button id="uploadCloud" class="save">上傳本機資料</button><button id="reviewCloud" class="cancel">比較版本，使用本機資料</button><button id="downloadCloud" class="cancel">下載雲端目前版本</button><button id="previousCloud" class="cancel">下載雲端上一版</button><button id="exportLocal" class="cancel">匯出目前資料 JSON</button><button id="restoreLocal" class="cancel">還原取代前的本機備份</button><button id="exportCloudBackup" class="cancel">匯出取代前的雲端備份</button><button id="exportBackup" class="cancel">匯出取代前的本機備份</button><p id="syncStatus" role="status" style="line-height:1.6;overflow-wrap:anywhere;margin:0"></p></div>';
  document.body.append(overlay,panel);
  const confirmLayer=document.createElement('div');confirmLayer.style.cssText='display:none;position:fixed;inset:0;z-index:14;background:#0f172a80;align-items:center;justify-content:center;padding:20px';
  confirmLayer.innerHTML='<section role="alertdialog" aria-modal="true" aria-labelledby="syncConfirmTitle" style="max-width:420px;width:100%;background:white;padding:22px;border-radius:20px"><h2 id="syncConfirmTitle" style="font-size:1.1rem;margin-top:0">確認資料操作</h2><p id="syncConfirmText" style="white-space:pre-wrap;line-height:1.6"></p><div class="dialog-actions"><button id="syncNo" class="cancel">取消</button><button id="syncYes" class="save">確認</button></div></section>';
  document.body.append(confirmLayer);
  let confirming=null;
  function confirmAction(message){return new Promise(resolve=>{
    $('#syncConfirmText').textContent=message;confirmLayer.style.display='flex';confirming=resolve;$('#syncNo').focus();
  })}
  function answer(value){confirmLayer.style.display='none';const resolve=confirming;confirming=null;resolve?.(value)}
  $('#syncNo').onclick=()=>answer(false);$('#syncYes').onclick=()=>answer(true);
  function apply(data){
    const keys=[storageKey,categoryKey,eventKey,longPlanKey],names=['tasks','categories','events','longPlans'],old=keys.map(k=>localStorage.getItem(k));
    try{keys.forEach((k,i)=>localStorage.setItem(k,JSON.stringify(data[names[i]])))}
    catch(error){keys.forEach((k,i)=>{try{old[i]===null?localStorage.removeItem(k):localStorage.setItem(k,old[i])}catch{}});throw error}
    tasks=data.tasks;categories=data.categories;events=data.events;longPlans=data.longPlans;selectedCategory=categories[0]?.id||'';
    hideEditor();renderLegend();renderCategoryPicker();renderCategoryManager();render();renderWeek();renderPanel();renderLongPlans();
  }
  const core=PlannerSync.create({url:API_URL,store:localStorage,snapshot,apply,confirm:confirmAction,fetch:(...args)=>fetch(...args)});
  function status(text){$('#syncStatus').textContent=text}
  function open(){
    $('#syncUser').value=localStorage.getItem('lazyPlanner.user')||'';
    overlay.classList.add('show');panel.classList.add('show');
    const meta=core.getMeta();status(meta?.savedAt?'上次取得的雲端版本：'+meta.version+'（'+meta.savedAt+'）':'尚未建立新版同步紀錄；請先匯出目前資料。');$('#syncUser').focus();
  }
  function close(){if(core.isBusy())return;overlay.classList.remove('show');panel.classList.remove('show');$('#cloudSyncBtn').focus()}
  $('#cloudSyncBtn').textContent='備份 / 同步';$('#cloudSyncBtn').onclick=open;$('#closeSync').onclick=close;overlay.onclick=close;
  function exportJSON(value,label){
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download='planner-'+label+'-'+new Date().toISOString().replaceAll(':','-')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('#exportLocal').onclick=()=>exportJSON({at:new Date().toISOString(),data:snapshot(),meta:core.getMeta()},'local');
  $('#exportCloudBackup').onclick=()=>{const b=core.getCloudBackup();b?exportJSON(b,'cloud-backup'):status('尚無已比較的雲端備份。')};
  $('#exportBackup').onclick=()=>{try{const b=core.getBackup();if(!b){status('尚無取代前備份。');return}exportJSON(b,'backup')}catch{status('備份格式無法讀取。')}};
  async function run(action){
    const user=$('#syncUser').value;
    if(!user.trim()&&action!=='restore'){status('請輸入原本的帳號名稱。');return}
    if(core.isBusy())return;
    panel.querySelectorAll('button,input').forEach(b=>b.disabled=true);$('#logoutBtn').disabled=true;
    status('處理中，請保留此畫面…');
    try{
      const result=(action==='upload'||action==='review')?await core.upload(user,action==='review'):action==='restore'?await core.restoreLocal():await core.download(user,action==='previous');
      if(result.cancelled){status('已取消，資料未取代。');return}
      if(result.empty){status('雲端沒有此帳號的資料；本機內容保持不變。');return}
      if(action!=='restore')localStorage.setItem('lazyPlanner.user',user);
      status((action==='upload'||action==='review')?(result.changed?'送出時的資料已儲存，後續修改尚未上傳。':'後端已確認儲存成功。'):'本機資料已更新，取代前內容已備份；雲端未改動。');
    }catch(error){status(error.name==='AbortError'?'連線逾時，儲存結果未確認。請保留本機資料，再按上傳重試。':error.message)}
    finally{panel.querySelectorAll('button,input').forEach(b=>b.disabled=false);$('#logoutBtn').disabled=false}
  }
  $('#reviewCloud').onclick=()=>run('review');
  $('#uploadCloud').onclick=()=>run('upload');$('#downloadCloud').onclick=()=>run('download');$('#previousCloud').onclick=()=>run('previous');$('#restoreLocal').onclick=()=>run('restore');
  $('#logoutBtn').textContent='登出（保留資料）';$('#logoutBtn').onclick=async()=>{
    if(core.isBusy())return;
    if(await confirmAction('登出帳號？本機計畫及備份會保留，不會清除資料。')){localStorage.removeItem('lazyPlanner.user');$('#syncUser').value='';showToast('已登出，本機資料仍保留')}
  };
  window.addEventListener('storage',event=>{
    if(!event.key||[storageKey,categoryKey,eventKey,longPlanKey,'lazyPlanner.cloudMeta.v2'].includes(event.key)){core.markStale();status('另一分頁已更新資料，請先匯出本頁資料再重新整理。')}
  });
  document.addEventListener('keydown',e=>{
    if(!confirming&&!panel.classList.contains('show'))return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();confirming?answer(false):close();return}
    if(e.key==='ArrowLeft'||e.key==='ArrowRight')e.stopImmediatePropagation();
    if(e.key==='Tab'){
      const container=confirming?confirmLayer:panel,controls=[...container.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
      if(!controls.length){e.preventDefault();return}
      if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus()}
      else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus()}
    }
  },true);
})();
