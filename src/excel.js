async function workbook(){const module=await import('exceljs');return new (module.default || module).Workbook();}
export async function readExcel(buffer) {
 const book=await workbook();await book.xlsx.load(buffer);
 return book.worksheets.map(sheet=>{
  if(sheet.rowCount>5001||sheet.columnCount>80)throw new Error('Each sheet must contain at most 5,000 records and 80 columns.');
  const width=sheet.columnCount,headers=Array.from({length:width},(_,i)=>sheet.getRow(1).getCell(i+1).text.trim());
  if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new Error(`Sheet ${sheet.name}: headers must be unique and non-empty.`);
  const rows=[];for(let i=2;i<=sheet.rowCount;i++){const row=sheet.getRow(i);if(!row.hasValues)continue;rows.push(Object.fromEntries(headers.map((h,j)=>[h,row.getCell(j+1).text])));}
  return {name:sheet.name,rows};
 });
}
export async function writeExcel(tables) {
 const book=await workbook();book.creator='Time Maker';const names=new Set();
 tables.forEach(({name,headers,rows})=>{
  const base=String(name).replaceAll('/',' ').replaceAll('\\',' ').replace(/[?*:\[\]]/g,' ').replace(/^'+|'+$/g,'').trim().slice(0,31)||'Worksheet';
  let safeName=base,index=2;while(names.has(safeName.toLowerCase()))safeName=base.slice(0,27)+' '+index++;names.add(safeName.toLowerCase());
  const sheet=book.addWorksheet(safeName);sheet.addRow(headers);rows.forEach(r=>sheet.addRow(r));sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17394D'}};sheet.columns.forEach(c=>{c.width=24;});sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};
 });
 return book.xlsx.writeBuffer();
}
export function downloadBuffer(name,buffer) {const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
