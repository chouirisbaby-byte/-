/* 懶人計畫表：重複目標計算。放在 index.html 的 </body> 前載入。
   不修改任務、雲端資料或 API_URL；此模式只計算每日份量。 */
(function(root){
  'use strict';
  function calculate(days,total){
    if(String(days).trim()===''||String(total).trim()==='')throw Error('請填入目標天數與總數。');
    days=Number(days);total=Number(total);
    if(!Number.isSafeInteger(days)||days<1)throw Error('目標天數請填大於 0 的整數。');
    if(!Number.isSafeInteger(total)||total<0)throw Error('總數請填 0 或正整數。');
    const low=Math.floor(total/days),highDays=total%days;
    return {days,total,average:total/days,low,high:low+1,lowDays:days-highDays,highDays};
  }
  root.PlannerRepetition={calculate};
  if(typeof document==='undefined')return;
  function mount(){
    const host=document.querySelector('#longPlanView'),list=document.querySelector('#longPlanList'),add=document.querySelector('#addLongPlan');
    if(!host||!list||document.querySelector('#repetitionPanel'))return;
    const style=document.createElement('style');
    style.textContent=`
      #repeatModes{display:flex;gap:6px;background:#e9edf3;border-radius:14px;padding:5px;margin:0 0 18px}
      #repeatModes button{flex:1;border:0;border-radius:10px;padding:12px 8px;font:inherit;font-weight:650;cursor:pointer;background:transparent;color:#526079;min-height:44px}
      #repeatModes button[aria-selected="true"]{background:#fff;color:#1d4ed8;box-shadow:0 2px 6px #0f172a12}
      #repetitionPanel[hidden],#longPlanList[hidden]{display:none!important}
      #repetitionPanel{background:white;border:1px solid #e2e8f0;border-radius:20px;padding:22px;color:#172033}
      #repetitionPanel h2{font-size:1.2rem;margin:0 0 8px}#repetitionPanel p{line-height:1.6}
      #repetitionPanel .repeat-help{color:#64748b;font-size:.9rem;margin:0 0 20px}
      #repetitionPanel .repeat-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      #repetitionPanel label{display:grid;gap:8px;font-weight:600;font-size:.9rem}
      #repetitionPanel input,#repetitionPanel select{box-sizing:border-box;min-width:0;width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font:inherit;font-size:16px;background:#fff;color:#172033}
      #repetitionPanel .repeat-unit{max-width:170px;margin:16px 0}
      #repetitionPanel .repeat-submit{border:0;border-radius:12px;background:#2563eb;color:white;padding:13px 22px;font:inherit;font-weight:650;cursor:pointer;width:100%}
      #repetitionPanel .repeat-result{margin-top:20px;border-radius:16px;padding:18px;background:#eff6ff}
      #repetitionPanel .repeat-average{font-size:1.65rem;font-weight:750;color:#1d4ed8;margin:4px 0 12px;overflow-wrap:anywhere}
      #repetitionPanel .repeat-result p{margin:6px 0}#repeatError{color:#b91c1c;margin:10px 0}
      #repeatModes button:focus-visible,#repetitionPanel :focus-visible{outline:3px solid #93c5fd;outline-offset:3px}
      @media(max-width:360px){#repetitionPanel{padding:16px}#repetitionPanel .repeat-fields{grid-template-columns:1fr}}
    `;
    document.head.append(style);
    const modes=document.createElement('div');modes.id='repeatModes';modes.setAttribute('role','tablist');modes.setAttribute('aria-label','計畫模式');
    modes.innerHTML='<button type="button" id="stageMode" role="tab" aria-selected="true" aria-controls="longPlanList">階段計畫</button><button type="button" id="repeatMode" role="tab" aria-selected="false" aria-controls="repetitionPanel" tabindex="-1">重複目標計算</button>';
    const panel=document.createElement('section');panel.id='repetitionPanel';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','repeatMode');
    panel.innerHTML='<h2>把總目標分配到每天</h2><p class="repeat-help">例如 20 天完成 40 回測驗卷，每天就是 2 回。</p><form id="repeatForm" novalidate><div class="repeat-fields"><label>目標天數<input id="repeatDays" type="number" min="1" step="1" inputmode="numeric" value="20" required></label><label>要完成的總數<input id="repeatTotal" type="number" min="0" step="1" inputmode="numeric" value="40" required></label></div><label class="repeat-unit">單位<select id="repeatUnit"><option>回</option><option>題</option><option>頁</option><option>個</option></select></label><button class="repeat-submit" type="submit">計算每天份量</button><p id="repeatError" role="alert" hidden></p></form><div id="repeatResult" class="repeat-result" role="status" aria-live="polite" aria-atomic="true" hidden><p>每日平均目標</p><p id="repeatAverage" class="repeat-average"></p><p id="repeatFormula"></p><p id="repeatDistribution"></p></div><p class="repeat-help" style="margin:16px 0 0">天數指實際安排練習的天數。這裡只計算份量，尚未建立日期或每日階段。</p>';
    list.before(modes);list.after(panel);
    list.setAttribute('role','tabpanel');list.setAttribute('aria-labelledby','stageMode');
    const tabs=[modes.querySelector('#stageMode'),modes.querySelector('#repeatMode')];
    function select(i){tabs.forEach((t,j)=>{t.setAttribute('aria-selected',String(i===j));t.tabIndex=i===j?0:-1});list.hidden=i===1;panel.hidden=i===0;if(add)add.hidden=i===1;}
    tabs.forEach((t,i)=>t.addEventListener('click',()=>select(i)));
    modes.addEventListener('keydown',e=>{let i=tabs.indexOf(document.activeElement);if(i<0)return;if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();i=e.key==='Home'?0:e.key==='End'?1:1-i;select(i);tabs[i].focus();}});
    const $=id=>panel.querySelector('#'+id),form=$('repeatForm');
    function update(){
      try{
        const r=calculate($('repeatDays').value,$('repeatTotal').value),u=$('repeatUnit').value;
        const fmt=x=>x.toLocaleString('zh-TW',{maximumFractionDigits:4});
        const prefix=Number.isInteger(r.average)?'':'約 ';
        $('repeatAverage').textContent=prefix+r.average.toLocaleString('zh-TW',{maximumSignificantDigits:6})+' '+u+'／天';
        $('repeatFormula').textContent=fmt(r.total)+' '+u+' ÷ '+fmt(r.days)+' 天';
        $('repeatDistribution').textContent=r.total===0?'目前沒有需要分配的數量。':r.highDays===0?'每天 '+fmt(r.low)+' '+u+'，共 '+fmt(r.days)+' 天。':'整數分配：'+fmt(r.highDays)+' 天各 '+fmt(r.high)+' '+u+'，其餘 '+fmt(r.lowDays)+' 天各 '+fmt(r.low)+' '+u+'。'+(r.low===0?'不需要每天都做。':'');
        $('repeatError').hidden=true;$('repeatResult').hidden=false;
      }catch(e){$('repeatError').textContent=e.message;$('repeatError').hidden=false;$('repeatResult').hidden=true;}
    }
    form.addEventListener('submit',e=>{e.preventDefault();update()});
    form.addEventListener('input',()=>{$('repeatResult').hidden=true;$('repeatError').hidden=true;});
    $('repeatUnit').addEventListener('change',update);
    update();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(globalThis);
