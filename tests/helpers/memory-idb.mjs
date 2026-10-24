// IndexedDB boundary double. Exercises shipped storage code and transaction
// rollback; browser compatibility is a separate manual check.
export function memoryIndexedDB(){
 const data=new Map(),history=[];let serial=Promise.resolve(),failId=null;
 const database={objectStoreNames:{contains:name=>data.has(name)},createObjectStore(name){data.set(name,new Map());},close(){},transaction(names,mode='readonly'){
  names=Array.isArray(names)?names:[names];const tasks=[];let started=false,done=false,pending=0,working,release;
  const previous=serial;serial=new Promise(resolve=>{release=resolve;});
  const tx={error:null,objectStore(kind){if(!names.includes(kind))throw new Error('Store outside transaction');return {get:id=>request(()=>structuredClone(working.get(kind).get(id))),getAll:()=>request(()=>[...working.get(kind).values()].map(v=>structuredClone(v))),put:row=>request(()=>{if(row.id===failId)throw new Error('QuotaExceededError');working.get(kind).set(row.id,structuredClone(row));return row.id;}),delete:id=>request(()=>working.get(kind).delete(id))};},abort(){if(done)return;done=true;setImmediate(()=>{tx.onabort?.();release();});}};
  function finish(){setImmediate(()=>{if(done||pending)return;if(mode==='readwrite')for(const name of names)data.set(name,working.get(name));done=true;tx.oncomplete?.();release();});}
  function request(operation){const req={};pending++;const run=()=>setImmediate(()=>{if(done)return;try{req.result=operation();req.onsuccess?.();pending--;if(!pending)finish();}catch(error){req.error=tx.error=error;req.onerror?.();tx.abort();}});if(started)run();else tasks.push(run);return req;}
  previous.then(()=>{if(done)return;started=true;working=new Map(names.map(name=>[name,new Map(data.get(name))]));history.push({names,mode});for(const task of tasks)task();if(!pending)finish();});
  return tx;
 }};
 return {history,failWritesTo:id=>{failId=id;},open(){const req={result:database};setImmediate(()=>{if(!data.size)req.onupgradeneeded?.();req.onsuccess?.();});return req;}};
}
