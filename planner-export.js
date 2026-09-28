/* Local-only PDF print preview and genuine DOCX export. No network dependencies. */
(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const typeLabels={all:'全部計畫',stage:'階段性計畫',repeat:'重複性計畫'};
const matchesType=(plan,type)=>type==='all'||(type==='repeat'?plan.type==='repeat':plan.type!=='repeat');
function collect(plans,{id='',start='',end='',type='all'}={}){
 if(!Object.hasOwn(typeLabels,type))throw Error('請選擇有效的計畫類型。');
 if(start&&end&&end<start)throw Error('結束日期不能早於開始日期。');
 return plans.filter(p=>matchesType(p,type)&&(!id||p.id===id)&&(!start||p.endDate>=start)&&(!end||p.startDate<=end)).map(p=>{
 const stages=(p.stages||[]).filter(s=>(!start||s.targetDate>=start)&&(!end||s.targetDate<=end)).slice().sort((a,b)=>a.targetDate.localeCompare(b.targetDate)||(a.startTime||'99:99').localeCompare(b.startTime||'99:99'));
 const all=p.stages||[],repeat=p.type==='repeat',done=all.filter(s=>s.done).reduce((n,s)=>n+(repeat?Number(s.quantity)||0:1),0),total=repeat?p.targetTotal:all.length;
 return {title:p.title,start:p.startDate,end:p.endDate,note:p.note||'',summary:repeat?`整個計畫：目標 ${total} 回，已完成 ${done} 回，剩餘 ${Math.max(0,total-done)} 回`:`整個計畫：已完成 ${done}／${total} 個階段`,rows:stages.map(s=>[s.targetDate,s.startTime&&s.endTime?s.startTime+'–'+s.endTime:'未排時間',s.title,repeat?String(s.quantity||0)+' 回':'—',s.done?'已完成':'未完成'])};
 }).sort((a,b)=>a.start.localeCompare(b.start));
}
const headers=['日期','時間','階段／每日安排','份量','狀態'];
function printHTML(plans,scope){return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>讀書計畫</title><style>body{font:12pt/1.6 system-ui,"Microsoft JhengHei",sans-serif;color:#111;max-width:950px;margin:24px auto;padding:0 20px}h1{font-size:24pt}h2{font-size:17pt;break-after:avoid}p{white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10pt;margin-bottom:25px}th,td{border:1px solid #d9d9d9;padding:8px;overflow-wrap:anywhere;vertical-align:middle}th{background:#e8eef5}th:nth-child(1){width:17%}th:nth-child(2){width:17%}th:nth-child(3){width:40%}th:nth-child(4),th:nth-child(5){width:13%}thead{display:table-header-group}tr{break-inside:avoid}button{padding:12px 18px;font:inherit}@page{size:A4;margin:18mm}@media print{body{margin:0;padding:0;max-width:none}.toolbar{display:none}}</style></head><body><div class="toolbar"><button id="print">列印／儲存 PDF</button><p>在列印介面選擇「另存為 PDF」。iPhone／iPad 可從列印預覽分享並儲存到檔案。</p></div><h1>讀書計畫</h1><p>'+esc(scope)+'</p>'+plans.map(p=>'<h2>'+esc(p.title)+'</h2><p>'+esc(p.start+' 至 '+p.end)+'<br>'+esc(p.summary)+'</p>'+(p.note?'<p>'+esc(p.note)+'</p>':'')+(p.rows.length?'<table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+p.rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p>此範圍沒有已排定階段。</p>')).join('')+'</body></html>';}
function zip(files){
 const enc=new TextEncoder(),parts=[],central=[];let offset=0;
 const u16=(v,n,x)=>v.setUint16(n,x,true),u32=(v,n,x)=>v.setUint32(n,x>>>0,true);
 function crc(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
 for(const [name,content]of Object.entries(files)){const n=enc.encode(name),b=enc.encode(content),c=crc(b),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x800);u16(v,12,33);u32(v,14,c);u32(v,18,b.length);u32(v,22,b.length);u16(v,26,n.length);h.set(n,30);parts.push(h,b);
 const ch=new Uint8Array(46+n.length),cv=new DataView(ch.buffer);u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x800);u16(cv,14,33);u32(cv,16,c);u32(cv,20,b.length);u32(cv,24,b.length);u16(cv,28,n.length);u32(cv,42,offset);ch.set(n,46);central.push(ch);offset+=h.length+b.length;}
 const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);u32(v,0,0x06054b50);u16(v,8,central.length);u16(v,10,central.length);u32(v,12,size);u32(v,16,offset);return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function docx(plans,scope){
 const clean=s=>esc(String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,''));
 const para=(s,style='Normal')=>'<w:p><w:pPr><w:pStyle w:val="'+style+'"/></w:pPr><w:r><w:t xml:space="preserve">'+clean(s)+'</w:t></w:r></w:p>';
 const widths=[1450,1450,3300,1000,1000];
 function table(rows){return '<w:tbl><w:tblPr><w:tblW w:w="8200" w:type="dxa"/><w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(k=>'<w:'+k+' w:val="single" w:sz="4" w:color="D9D9D9"/>').join('')+'</w:tblBorders><w:tblCellMar><w:top w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+widths.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>'+[headers,...rows].map((r,i)=>'<w:tr><w:trPr>'+(i===0?'<w:tblHeader/>':'')+'</w:trPr>'+r.map((c,j)=>'<w:tc><w:tcPr><w:tcW w:w="'+widths[j]+'" w:type="dxa"/><w:vAlign w:val="center"/>'+(i===0?'<w:shd w:fill="E8EEF5"/>':'')+'</w:tcPr>'+para(c,'TableText')+'</w:tc>').join('')+'</w:tr>').join('')+'</w:tbl>'+para('');}
 const body=para('讀書計畫','Title')+para(scope)+plans.map(p=>para(p.title,'Heading1')+para(p.start+' 至 '+p.end)+para(p.summary)+(p.note?p.note.split(/\r?\n/).map(l=>para(l)).join(''):'')+(p.rows.length?table(p.rows):para('此範圍沒有已排定階段。'))).join('');
 const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 return zip({'[Content_Types].xml':xml+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
 '_rels/.rels':xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
 'word/_rels/document.xml.rels':xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
 'word/styles.xml':xml+'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft JhengHei"/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="44"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="260" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="TableText"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="20"/></w:rPr></w:style></w:styles>',
 'word/document.xml':xml+'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1020" w:right="1020" w:bottom="1020" w:left="1020"/></w:sectPr></w:body></w:document>'});
}
root.PlannerExport={collect,printHTML,docx};
if(typeof document==='undefined')return;
const host=document.querySelector('#longPlanView .long-head');if(!host)return;
const button=document.createElement('button');button.type='button';button.className='long-add';button.textContent='匯出 PDF／Word';host.style.flexWrap='wrap';host.append(button);
const dialog=document.createElement('dialog');dialog.style.cssText='border:1px solid #cbd5e1;border-radius:18px;padding:22px;width:min(440px,85vw);max-height:85vh;overflow:auto;color:#172033';dialog.setAttribute('aria-labelledby','exportHeading');
dialog.innerHTML='<form method="dialog"><h2 id="exportHeading">匯出計畫</h2><p>匯出目前本機計畫。日期範圍只篩選明細，進度仍標示整個計畫。</p><label>計畫類型<select id="exportType" style="display:block;width:100%;padding:10px;margin:8px 0 16px"><option value="all">全部計畫</option><option value="stage">階段性計畫</option><option value="repeat">重複性計畫</option></select></label><label>計畫<select id="exportPlan" style="display:block;width:100%;padding:10px;margin:8px 0 16px"></select></label><label>開始日期（選填）<input id="exportStart" type="date" style="display:block;padding:10px;margin:8px 0 16px"></label><label>結束日期（選填）<input id="exportEnd" type="date" style="display:block;padding:10px;margin:8px 0 16px"></label><p id="exportStatus" role="status"></p><div style="display:flex;flex-wrap:wrap;gap:8px"><button type="button" id="exportPDF" class="save">PDF 列印預覽</button><button type="button" id="exportWord" class="save">下載 Word</button><button class="cancel">關閉</button></div></form>';document.body.append(dialog);
const $=s=>dialog.querySelector(s);
function refreshPlanOptions(){
 const select=$('#exportPlan'),previous=select.value,type=$('#exportType').value;
 select.replaceChildren(new Option('此類型的全部計畫',''));
 for(const p of longPlans.filter(p=>matchesType(p,type)))select.add(new Option(p.title,p.id));
 if([...select.options].some(o=>o.value===previous))select.value=previous;
 $('#exportStatus').textContent=select.options.length===1?'此類型目前沒有計畫。':'';
}
$('#exportType').onchange=refreshPlanOptions;
button.onclick=()=>{refreshPlanOptions();dialog.showModal();};
function selection(){const start=$('#exportStart').value,end=$('#exportEnd').value,id=$('#exportPlan').value,type=$('#exportType').value,p=collect(longPlans,{id,start,end,type});if(!p.length)throw Error('此類型與日期範圍沒有可匯出的計畫。');return {plans:p,scope:'計畫類型：'+typeLabels[type]+'\n明細範圍：'+(start||'不限起日')+' 至 '+(end||'不限迄日')};}
$('#exportWord').onclick=()=>{try{const s=selection(),url=URL.createObjectURL(docx(s.plans,s.scope)),a=document.createElement('a');a.href=url;a.download='讀書計畫.docx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#exportStatus').textContent='已產生 Word 檔案，請查看下載項目。';}catch(e){$('#exportStatus').textContent=e.message;}};
$('#exportPDF').onclick=()=>{try{const s=selection(),w=window.open('','_blank');if(!w)throw Error('請允許此網站開啟列印預覽視窗。');w.opener=null;w.document.open();w.document.write(printHTML(s.plans,s.scope));w.document.close();w.document.querySelector('#print').onclick=()=>w.print();$('#exportStatus').textContent='預覽已開啟，請按「列印／儲存 PDF」。';}catch(e){$('#exportStatus').textContent=e.message;}};
})(globalThis);
