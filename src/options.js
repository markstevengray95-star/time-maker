import {norm} from './timetableCore.js';
export function importChoices(rows) {
 const seen=new Set();
 return rows.map((raw,index)=>{
  const row=Object.fromEntries(Object.entries(raw).map(([key,value])=>[norm(key),value]));
  const studentId=String(row.studentid || '').trim();if(!studentId)throw new Error(`Row ${index+2}: studentId is required.`);
  if(seen.has(studentId))throw new Error(`Row ${index+2}: duplicate studentId ${studentId}.`);seen.add(studentId);
  const choices=Object.keys(row).filter(k=>/^choice\d+$/.test(k)).sort((a,b)=>Number(a.slice(6))-Number(b.slice(6))).map(k=>row[k]).filter(Boolean);
  if(!choices.length)throw new Error(`Row ${index+2}: add choice1, choice2 and further ranked choice columns.`);
  if(new Set(choices.map(norm)).size!==choices.length)throw new Error(`Row ${index+2}: repeated subject choice.`);
  return {id:studentId,name:row.name || studentId,year:row.year || '',choices};
 });
}
export function evaluateBlocks(students,assignment,blockCount) {
 let full=0,received=0,rankScore=0;
 const pupils=students.map(s=>{
  const used=new Set(),achieved=[],unmet=[];
  s.choices.forEach((subject,index)=>{const b=assignment[norm(subject)];if(b!==undefined&&!used.has(b)){used.add(b);achieved.push(subject);rankScore+=s.choices.length-index;}else unmet.push(subject);});
  received+=achieved.length;if(!unmet.length)full++;
  return {...s,achieved,unmet};
 });
 return {full,received,rankScore,pupils,score:full*100000000+received*10000+rankScore,blockCount};
}
export function generateOptionBlocks(students,blockCount=3,maxSubjects=6) {
 if(!students.length)throw new Error('Import student choices first.');
 if(!Number.isInteger(blockCount)||blockCount<2||blockCount>8)throw new Error('Choose 2–8 blocks.');
 if(!Number.isInteger(maxSubjects)||maxSubjects<1||maxSubjects>80)throw new Error('Choose 1–80 subjects per block.');
 const subjects=[...new Map(students.flatMap(s=>s.choices).map(s=>[norm(s),s])).values()];
 if(subjects.length>blockCount*maxSubjects)throw new Error('Increase the number of blocks or subjects allowed per block.');
 if(subjects.length>80||students.length>5000)throw new Error('Use a cohort of at most 5,000 pupils and 80 subjects.');
 const conflict=new Map();students.forEach(s=>s.choices.forEach(a=>s.choices.forEach(b=>{if(a!==b){const key=[norm(a),norm(b)].sort().join('|');conflict.set(key,(conflict.get(key)||0)+1);}})));
 const degree=s=>[...conflict.entries()].filter(([key])=>key.split('|').includes(norm(s))).reduce((n,[,count])=>n+count,0);
 const ordered=[...subjects].sort((a,b)=>degree(b)-degree(a)||a.localeCompare(b));
 let best=null;
 for(let restart=0;restart<12;restart++){
  const assignment={},sizes=Array(blockCount).fill(0),order=[...ordered.slice(restart%ordered.length),...ordered.slice(0,restart%ordered.length)];
  order.forEach(subject=>{
   const choices=Array.from({length:blockCount},(_,b)=>b).filter(b=>sizes[b]<maxSubjects);
   choices.sort((a,b)=>{
    const cost=block=>Object.entries(assignment).filter(([,v])=>v===block).reduce((n,[s])=>n+(conflict.get([norm(subject),s].sort().join('|')) || 0),0);
    return cost(a)-cost(b)||sizes[a]-sizes[b]||((a+restart)%blockCount)-((b+restart)%blockCount);
   });assignment[norm(subject)]=choices[0];sizes[choices[0]]++;
  });
  let result=evaluateBlocks(students,assignment,blockCount);
  for(let pass=0;pass<12;pass++){
   let improved=false;
   for(const subject of subjects){const key=norm(subject),old=assignment[key];
    for(let b=0;b<blockCount;b++){if(b===old||sizes[b]>=maxSubjects)continue;assignment[key]=b;const candidate=evaluateBlocks(students,assignment,blockCount);
     if(better(candidate,result)){sizes[old]--;sizes[b]++;result=candidate;improved=true;break;}assignment[key]=old;
    }
   }
   // Swaps can improve a solution even when every block is at capacity.
   for(let i=0;i<subjects.length;i++)for(let j=i+1;j<subjects.length;j++){
    const a=norm(subjects[i]),b=norm(subjects[j]);if(assignment[a]===assignment[b])continue;
    [assignment[a],assignment[b]]=[assignment[b],assignment[a]];
    const candidate=evaluateBlocks(students,assignment,blockCount);
    if(better(candidate,result)){result=candidate;improved=true;}else [assignment[a],assignment[b]]=[assignment[b],assignment[a]];
   }
   if(!improved)break;
  }
  if(!best||better(result,best))best={...result,assignment:{...assignment}};
  if(best.full===students.length)break;
 }
 return {...best,blocks:Array.from({length:blockCount},(_,i)=>({name:`Option ${String.fromCharCode(65+i)}`,subjects:subjects.filter(s=>best.assignment[norm(s)]===i)})),total:students.length,createdAt:new Date().toISOString()};
}
function better(a,b){return a.full!==b.full?a.full>b.full:a.received!==b.received?a.received>b.received:a.rankScore>b.rankScore;}
