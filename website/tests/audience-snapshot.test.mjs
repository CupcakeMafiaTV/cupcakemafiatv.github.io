import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {audienceCount,refreshAudience} from '../scripts/refresh-audience-snapshot.mjs';
const oldDate='2026-11-11T15:00:00Z';
const now=new Date('2026-11-13T18:00:00Z');
async function fixture(callback){
 const dir=await mkdtemp(path.join(tmpdir(),'cmtv-audience-'));
 await writeFile(path.join(dir,'socials.json'),JSON.stringify(Object.fromEntries(['x','instagram','tiktok'].map((key,i)=>[key,{followers:53+i,verifiedAt:oldDate,source:'https://example.com/'+key}]))));
 await writeFile(path.join(dir,'audience_snapshot.json'),JSON.stringify({platforms:{twitch:{count:670,verifiedAt:oldDate},youtube:{count:432,verifiedAt:oldDate},discord:{count:75,verifiedAt:oldDate}}}));
 try{await callback(dir);}finally{await rm(dir,{recursive:true,force:true});}
}
test('publication refresh uses exactly the three existing cached endpoints and preserves manual dates',()=>fixture(async dir=>{
 const calls=[];const snapshot=await refreshAudience({dataDirectory:dir,now,fetchImpl:async url=>{calls.push(url);return Response.json(url.endsWith('subscribers')?{subscriberCount:'433'}:url.endsWith('twitch-followers')?{followerCount:0}:{memberCount:75});}});
 assert.equal(calls.length,3);assert.equal(snapshot.platforms.youtube.count,433);assert.equal(snapshot.platforms.twitch.count,0);assert.equal(snapshot.platforms.youtube.verifiedAt,now.toISOString());assert.equal(snapshot.platforms.x.verifiedAt,oldDate);assert.deepEqual(JSON.parse(await readFile(path.join(dir,'audience_snapshot.json'),'utf8')),snapshot);
}));
test('unavailable services retain their actual previous dates instead of appearing newly verified',()=>fixture(async dir=>{
 const snapshot=await refreshAudience({dataDirectory:dir,now,logger:{warn(){}},fetchImpl:async()=>{throw Error('offline');}});
 assert.equal(snapshot.platforms.youtube.count,432);assert.equal(snapshot.platforms.youtube.verifiedAt,oldDate);assert.equal(snapshot.platforms.discord.verifiedAt,oldDate);
}));
test('malformed counts cannot replace verified values',()=>fixture(async dir=>{
 const snapshot=await refreshAudience({dataDirectory:dir,now,logger:{warn(){}},fetchImpl:async()=>Response.json({subscriberCount:-1,memberCount:true,followerCount:'unknown'})});
 assert.equal(snapshot.platforms.youtube.count,432);assert.equal(snapshot.platforms.discord.count,75);assert.equal(snapshot.platforms.twitch.count,670);
 for(const value of [null,undefined,true,'',-1,1.5,'bad'])assert.equal(audienceCount(value),null);
}));
