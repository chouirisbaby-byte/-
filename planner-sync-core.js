(function(root){
  const META='lazyPlanner.cloudMeta.v2',BACKUP='lazyPlanner.localBackup.v2',PENDING='lazyPlanner.pendingUpload.v2';
  function validate(data){
    const date=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number);return m>=1&&m<=12&&d>=1&&d<=new Date(y,m,0).getDate()};
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error('資料格式不完整，已停止取代。');
    for(const key of ['tasks','categories','events','longPlans']){
      if(!Array.isArray(data[key]))throw Error('資料缺少 '+key+'，已停止取代。');
      const ids=new Set();
      for(const item of data[key]){
        if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id)||typeof item[key==='categories'?'name':'title']!=='string')throw Error('資料項目格式錯誤，已停止取代。');
        ids.add(item.id);
        if((key==='tasks'||key==='events')&&!date(item.date))throw Error('事件日期無效，已停止取代。');
        if(key==='longPlans'&&(!date(item.startDate)||!date(item.endDate)||item.startDate>item.endDate))throw Error('計畫日期無效，已停止取代。');
        if(key==='longPlans'&&(!Array.isArray(item.stages)||!item.stages.every(s=>s&&typeof s.id==='string'&&typeof s.title==='string'&&typeof s.targetDate==='string')))throw Error('計畫階段格式錯誤，已停止取代。');
        if(key==='longPlans'&&(!item.stages.every(s=>date(s.targetDate))||new Set(item.stages.map(s=>s.id)).size!==item.stages.length))throw Error('階段日期或識別碼錯誤，已停止取代。');
      }
    }
    return data;
  }
  function create(options){
    const {store,snapshot,apply,confirm}=options;
    function read(key){const raw=store.getItem(key);return raw?JSON.parse(raw):null}
    let meta=read(META),busy=false,stale=false;
    const stamp=()=>JSON.stringify(snapshot());
    async function request(user,params,post=false){
      const url=new URL(options.url),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
      const body=new URLSearchParams({user,...params});
      if(!post){for(const [k,v]of body)url.searchParams.set(k,v);url.searchParams.set('_',Date.now().toString())}
      try{
        const res=await options.fetch(url.toString(),{method:post?'POST':'GET',...(post?{body}:{}),signal:controller.signal,redirect:'follow'});
        if(!res.ok)throw Error('伺服器回應失敗，沒有確認同步成功。');
        const json=await res.json();
        if(json.protocol!==2)throw Error('後端尚未更新，請先部署新版 Code.gs。');
        if(!json.success){const error=Error(json.error||'同步失敗，本機資料仍保留。');error.code=json.code;throw error}
        if(json.user!==user||typeof json.revision!=='string'||!json.revision)throw Error('回應帳號或版本不符，已停止同步。');
        return json;
      }finally{clearTimeout(timer)}
    }
    function backup(){
      // This must succeed BEFORE replacing any local record.
      store.setItem(BACKUP,JSON.stringify({at:new Date().toISOString(),data:validate(snapshot()),meta}));
    }
    function replace(data,nextMeta){
      const previous=validate(snapshot()),oldMeta=meta;
      backup();
      try{apply(data);store.setItem(META,JSON.stringify(nextMeta));meta=nextMeta}
      catch(error){try{apply(previous);store.setItem(META,JSON.stringify(oldMeta))}catch{}throw Error('本機儲存失敗；已保留取代前備份，請匯出備份。')}
    }
    async function guarded(fn){
      if(busy)throw Error('正在同步，請稍候。');
      if(stale)throw Error('另一個分頁已修改資料。請先匯出本頁資料，再重新整理。');
      busy=true;try{return await fn()}finally{busy=false}
    }
    async function upload(user,review=false){return guarded(async()=>{
      const data=validate(snapshot()),raw=JSON.stringify(data);
      const switching=!!meta&&meta.user!==user;
      let revision=switching?null:meta?.revision;
      if(!revision||review){
        const cloud=await request(user,{});
        const remote=cloud.exists?validate(JSON.parse(cloud.data)):null;
        if(switching||review||(remote&&JSON.stringify(remote)!==raw)){
          const counts=x=>['tasks','categories','events','longPlans'].map(k=>x[k].length).join(' / ');
          const message=(switching?'目前資料來自「'+meta.user+'」。\n':'')+'將本機資料上傳到「'+user+'」？\n'+(remote?'項目數：非計畫性事件 / 類別 / 重大事項 / 計畫\n本機：'+counts(data)+'\n雲端：'+counts(remote)+'（第 '+cloud.version+' 版）\n\n確認後會取代此帳號的雲端資料，不會合併。':'此帳號尚無雲端資料。')+'\n程式會先自動備份，無需先手動匯出。';
          if(!await confirm(message))return {cancelled:true};
          if(stale||stamp()!==raw)throw Error('資料已變更，請重新上傳。');
          backup();
          if(remote)store.setItem('lazyPlanner.cloudBackup.v2',JSON.stringify({at:new Date().toISOString(),user,data:remote,revision:cloud.revision,version:cloud.version}));
        }
        revision=cloud.revision;
      }
      if(stale||stamp()!==raw)throw Error('檢查期間本機資料已變更，請重新上傳。');
      let pending=read(PENDING);
      if(!pending||pending.user!==user||pending.data!==raw||pending.revision!==revision)pending={user,data:raw,revision,id:root.crypto?.randomUUID?.()||Date.now()+'-'+Math.random()};
      store.setItem(PENDING,JSON.stringify(pending));
      const result=await request(user,{data:raw,expectedRevision:revision,requestId:pending.id},true);
      if(result.requestId!==pending.id||result.data!==raw)throw Error('後端未確認完整內容，請保留本機資料並重試。');
      const nextMeta={user,revision:result.revision,version:result.version,savedAt:result.savedAt};
      // Never advance a different tab's revision under this tab's older snapshot.
      if(stale)throw Error('雲端已回覆，但另一分頁同時修改了本機。請匯出本頁資料後重新整理。');
      store.setItem(META,JSON.stringify(nextMeta));meta=nextMeta;
      return {success:true,changed:stamp()!==raw,version:result.version};
    })}
    async function download(user,previous=false){return guarded(async()=>{
      const before=stamp(),result=await request(user,previous?{action:'previous'}:{});
      if(!result.exists)return {empty:true};
      const data=validate(JSON.parse(result.data));
      if(stale||stamp()!==before)throw Error('下載期間本機已修改，已停止取代。');
      if(!await confirm((previous?'下載雲端上一版':'下載雲端目前版本')+'到本機？將先備份本機目前內容，再取代畫面；不會修改雲端。'))return {cancelled:true};
      if(stale||stamp()!==before)throw Error('本機已變更，已停止取代。');
      replace(data,{user,revision:result.revision,version:result.version,savedAt:result.savedAt});
      return {success:true,restored:previous};
    })}
    async function restoreLocal(){return guarded(async()=>{
      const saved=read(BACKUP);if(!saved)throw Error('目前沒有取代前備份。');
      validate(saved.data);
      if(!await confirm('還原 '+saved.at+' 的本機備份？目前內容會先備份，雲端不會改動。'))return {cancelled:true};
      replace(saved.data,saved.meta||null);return {success:true};
    })}
    return {upload,download,restoreLocal,markStale:()=>stale=true,getBackup:()=>read(BACKUP),getCloudBackup:()=>read('lazyPlanner.cloudBackup.v2'),getMeta:()=>meta,isBusy:()=>busy};
  }
  root.PlannerSync={create,validate};
})(globalThis);
