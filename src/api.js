let csrf='';
export const setCSRF=value=>{csrf=value || '';};
export async function api(path,options={}) {
 const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)});
 const type=response.headers.get('content-type') || '';if(!type.includes('application/json'))throw new Error('Portal server is unavailable.');const result=await response.json();if(!response.ok)throw new Error(result.error || 'Request failed.');return result;
}
