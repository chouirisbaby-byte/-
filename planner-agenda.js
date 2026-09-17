(function(root) {
  function daily(tasks, plans, categories, date) {
    const rows=[];
    function add(item,kind,plan) {
      const cat=categories.find(c=>c.id===item.category);
      const timed=item.startTime && item.endTime && root.PlannerTime.isValidTimeRange(item.startTime,item.endTime);
      rows.push({key:JSON.stringify([kind,plan?.id||'',item.id]),kind,id:item.id,planId:plan?.id||'',title:item.title||'',sourceName:plan?.title||cat?.name||'未分類',color:plan?.color||cat?.color||'#64748b',done:Boolean(item.done),startTime:timed?item.startTime:'',endTime:timed?item.endTime:'',overlap:false});
    }
    tasks.filter(t=>t.date===date).forEach(t=>add(t,'task'));
    plans.forEach(p=>(p.stages||[]).filter(s=>s.targetDate===date).forEach(s=>add(s,'stage',p)));
    rows.sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99')||(a.endTime||'99:99').localeCompare(b.endTime||'99:99'));
    for (const row of rows) row.overlap=Boolean(row.startTime && rows.some(other=>other!==row && other.startTime && row.startTime<other.endTime && other.startTime<row.endTime));
    return rows;
  }
  root.PlannerAgenda={daily};
})(globalThis);
