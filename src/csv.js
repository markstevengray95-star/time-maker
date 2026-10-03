export function parseCSV(text) {
  const rows=[];let row=[],cell='',quoted=false;
  const input=String(text).replace(/^\uFEFF/,'');
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else if(quoted){quoted=false;}else if(!cell){quoted=true;}else throw new Error('Unexpected quote in CSV field.');}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Unclosed quoted field in CSV.');
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  if(!rows.length)return [];
  const headers=rows.shift().map(h=>h.trim());
  if(headers.some(h=>!h)||new Set(headers.map(h=>h.toLowerCase())).size!==headers.length)throw new Error('CSV headers must be unique and non-empty.');
  return rows.map((values,index)=>{if(values.length!==headers.length)throw new Error(`Row ${index+2}: expected ${headers.length} fields, found ${values.length}.`);return Object.fromEntries(headers.map((h,i)=>[h,values[i].trim()]));});
}
export function toCSV(headers,rows) {
  const quote=value=>{let cell=String(value ?? '');if(/^[=+@\-\t\r]/.test(cell))cell="'"+cell;return '"'+cell.replaceAll('"','""')+'"';};
  return [headers,...rows].map(row=>row.map(quote).join(',')).join('\r\n');
}
export function downloadText(name,text,type='text/csv;charset=utf-8') {
  const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
