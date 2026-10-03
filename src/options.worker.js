import {generateOptionBlocks} from './options.js';
self.onmessage=({data})=>{try{self.postMessage({result:generateOptionBlocks(data.students,data.blockCount,data.maxSubjects)});}catch(e){self.postMessage({error:e.message});}};
