import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const definitions={
 twitch:{unit:'followers',endpoint:'twitch-followers',field:'followerCount'},
 youtube:{unit:'subscribers',endpoint:'subscribers',field:'subscriberCount'},
 discord:{unit:'members',endpoint:'discord-widget',field:'memberCount'}
};
export function audienceCount(value){
 if(value===null||value===undefined||typeof value==='boolean'||String(value).trim()==='')return null;
 const number=Number(value);return Number.isSafeInteger(number)&&number>=0?number:null;
}
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export async function refreshAudience({dataDirectory,fetchImpl=fetch,now=new Date(),logger=console}={}){
 const savedPath=path.join(dataDirectory,'audience_snapshot.json');
 let previous={};try{previous=JSON.parse(await readFile(savedPath,'utf8'));}catch{}
 const manual=JSON.parse(await readFile(path.join(dataDirectory,'socials.json'),'utf8'));
 const platforms={};
 for(const platform of ['x','instagram','tiktok']){
  const entry=manual[platform];
  if(audienceCount(entry?.followers)===null||!validDate(entry?.verifiedAt))throw Error('Missing verified '+platform+' audience data');
  platforms[platform]={count:audienceCount(entry.followers),unit:'followers',verifiedAt:entry.verifiedAt,source:entry.source};
 }
 await Promise.all(Object.entries(definitions).map(async([platform,definition])=>{
  const source='https://cupcakemafiatv-github-io.vercel.app/api/'+definition.endpoint;
  const old=previous.platforms?.[platform];
  let entry={count:audienceCount(old?.count),unit:definition.unit,verifiedAt:validDate(old?.verifiedAt)?old.verifiedAt:null,source};
  try{
   const response=await fetchImpl(source,{signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('Unavailable');
   const data=await response.json();
   if(data?.available===false||data?.stale===true)throw Error('Unconfirmed count');
   const value=audienceCount(data?.[definition.field]);
   if(value===null)throw Error('Missing count');
   entry={count:value,unit:definition.unit,verifiedAt:now.toISOString(),source};
  }catch{logger.warn(platform+': retained the previous count and its original check date.');}
  platforms[platform]=entry;
 }));
 const snapshot={version:1,preparedAt:now.toISOString(),platforms};
 await writeFile(savedPath,JSON.stringify(snapshot,null,2)+'\n');
 return snapshot;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const dataDirectory=fileURLToPath(new URL('../data/',import.meta.url));
 const snapshot=await refreshAudience({dataDirectory});
 console.log('Audience snapshot: '+Object.entries(snapshot.platforms).map(([name,entry])=>name+' '+(entry.count??'unavailable')).join(', '));
}
