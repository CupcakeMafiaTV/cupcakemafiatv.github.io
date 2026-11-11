import test from 'node:test';import assert from 'node:assert/strict';import {soloHistory} from '../api/_solo-history.js';
test('Only Solo/Duo requested; repeat visitors and existing match details reuse cache',async()=>{let calls=0;let saved=null;const redis=async cmd=>{if(cmd[0]==='GET')return saved;saved=cmd[2];return 'OK'};const riot=async url=>{calls++;if(url.includes('/ids?')){assert.ok(url.includes('queue=420'));return Response.json(['NA1_1','NA1_2']);}return Response.json({info:{queueId:420,participants:[{puuid:'p',win:url.endsWith('_1'),championName:'Zoe'}]}})};const a=await soloHistory('p',riot,redis,1000000);assert.deepEqual(a.matches.map(m=>m.result),['W','L']);assert.equal(calls,3);await soloHistory('p',riot,redis,1000001);assert.equal(calls,3);await soloHistory('p',riot,redis,2000000);assert.equal(calls,4);});
test('Rate limiting keeps last confirmed history and prevents immediate retries',async()=>{let calls=0;const riot=async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'120'}})};const redis=async()=>null;const result=await soloHistory('p',riot,redis,3000000);assert.equal(result.stale,true);const prior=calls;await soloHistory('p',riot,redis,3000001);assert.equal(calls,prior);});

test('Returns eight Solo/Duo games and reuses details on refresh',async()=>{
 let calls=0;const ids=Array.from({length:8},(_,i)=>'NA1_'+(100+i));
 const riot=async url=>{calls++;if(url.includes('/ids?')){assert.ok(url.includes('count=8'));return Response.json(ids);}return Response.json({info:{queueId:420,gameEndTimestamp:1794285301779,participants:[{puuid:'p',win:true,championName:'Zoe'}]}});};
 const result=await soloHistory('p',riot,async()=>null,5000000);
 assert.equal(result.matches.length,8);assert.equal(calls,9);
 await soloHistory('p',riot,async()=>null,6000000);assert.equal(calls,10);
});
