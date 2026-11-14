import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function characterSnapshot(value,now=Date.now()){
 if(value?.available!==true||!Number.isSafeInteger(value.level)||value.level<1||value.level>100)return null;
 const time=Date.parse(value.updatedAt);
 if(!Number.isFinite(time)||time>now+60000)return null;
 let artwork=null;
 try{const u=new URL(value.artwork);if(u.protocol==='https:'&&u.hostname==='render.worldofwarcraft.com'&&!u.username&&!u.password)artwork=u.href;}catch{}
 return {available:true,level:value.level,specialization:['Enhancement','Elemental','Restoration'].includes(value.specialization)?value.specialization:null,artwork,updatedAt:value.updatedAt};
}
export async function refreshGameSnapshot({dataDirectory,fetchImpl=fetch,logger=console}={}){
 const filename=path.join(dataDirectory,'game_snapshot.json');
 let previous={};try{previous=JSON.parse(await readFile(filename,'utf8'));}catch{}
 let wow=characterSnapshot(previous.wow);
 try{
  const response=await fetchImpl('https://cupcakemafiatv-github-io.vercel.app/api/wow-character',{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Unavailable');
  const current=characterSnapshot(await response.json());
  if(!current)throw Error('Invalid character');
  if(!wow||Date.parse(current.updatedAt)>=Date.parse(wow.updatedAt))wow=current;
 }catch{logger.warn('WoW: retained the last confirmed character snapshot.');}
 const snapshot={version:1,wow};
 await writeFile(filename,JSON.stringify(snapshot,null,2)+'\n');
 return snapshot;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const snapshot=await refreshGameSnapshot({dataDirectory:fileURLToPath(new URL('../data/',import.meta.url))});
 console.log(snapshot.wow?'WoW fallback refreshed: level '+snapshot.wow.level:'WoW fallback unavailable.');
}
