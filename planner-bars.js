(function(root) {
  const parse=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return new Date(NaN);const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
  function month(plans,year,monthIndex) {
    const start=new Date(year,monthIndex,1),end=new Date(year,monthIndex+1,0);
    const sorted=[...plans].sort((a,b)=>(a.startDate||'').localeCompare(b.startDate||'')||(a.endDate||'').localeCompare(b.endDate||'')||String(a.id).localeCompare(String(b.id)));
    return Array.from({length:6},(_,week)=>{
      const weekStart=new Date(year,monthIndex,1-start.getDay()+week*7),weekEnd=new Date(year,monthIndex,7-start.getDay()+week*7);
      const segments=[];
      for(const p of sorted) {
        const ps=parse(p.startDate),pe=parse(p.endDate);
        const left=new Date(Math.max(ps,weekStart,start)),right=new Date(Math.min(pe,weekEnd,end));
        if(ps<=pe && left<=right) segments.push({planId:p.id,title:p.title,color:p.color||'#4f46e5',startColumn:left.getDay(),endColumn:right.getDay(),lane:segments.length,continuesBefore:ps<left,continuesAfter:pe>right});
      }
      return {segments:segments.slice(0,2),hiddenCount:Math.max(0,segments.length-2)};
    });
  }
  root.PlannerBars={month};
})(globalThis);
