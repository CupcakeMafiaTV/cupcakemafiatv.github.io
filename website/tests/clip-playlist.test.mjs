import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleClips, pickNextClip} from '../themes/cupcakemafiatv/static/js/clip-playlist.js';
import handler from '../api/twitch-clips.js';
const now=Date.now();
const clips=Array.from({length:30},(_,i)=>({id:'clip-'+i,createdAt:new Date(now-86400000).toISOString(),embedUrl:'https://clips.twitch.tv/embed?clip=clip-'+i}));
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}};
test('All 30 valid clips stay eligible; stale, future, unsafe and duplicate clips are excluded',()=>{
 const pool=eligibleClips([...clips,clips[0],{...clips[0],id:'old',createdAt:new Date(now-366*86400000).toISOString()},{...clips[0],id:'future',createdAt:new Date(now+86400000).toISOString()},{...clips[0],id:'unsafe',embedUrl:'https://example.com/embed?clip=unsafe'}],now);
 assert.equal(pool.length,30);
 const older={...clips[0],createdAt:new Date(now-200*86400000).toISOString()};assert.equal(eligibleClips([older],now).length,1);
});
test('Each round visits every clip once and reloads retain history',()=>{
 const storage=memory();let last;
 for(let round=0;round<3;round++){const ids=Array.from({length:30},()=>pickNextClip(clips,storage).id);assert.equal(new Set(ids).size,30);assert.notEqual(ids[0],last);last=ids.at(-1);}
 const added={...clips[0],id:'new'};assert.equal(pickNextClip([...clips,added],storage).id,'new');
});
test('Blocked or malformed storage and single-clip pools still play',()=>{
 const storage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.equal(pickNextClip([clips[0]],storage).id,clips[0].id);
 assert.equal(pickNextClip([],storage),null);
 assert(pickNextClip(clips,{getItem:()=>'{broken',setItem(){}}));
});
test('API follows pagination, refreshes expired auth and returns more than 10 clips',async()=>{
 const originalFetch=globalThis.fetch, originalEnv={...process.env};let pages=0,tokens=0;
 process.env.TWITCH_CLIENT_ID='test';process.env.TWITCH_CLIENT_SECRET='test';process.env.TWITCH_BROADCASTER_ID='test';delete process.env.KV_REST_API_URL;
 globalThis.fetch=async(url)=>{
   if(String(url).includes('oauth2/token')){tokens++;return Response.json({access_token:'fake'});}
   pages++;if(pages===1)return new Response('',{status:401});
   const offset=new URL(url).searchParams.has('after')?20:0;
   return Response.json({data:Array.from({length:20},(_,i)=>({id:'api-'+(offset+i),game_id:i%2?'21779':'other-game',created_at:new Date(now-(offset+i)*1000).toISOString()})),pagination:offset?{}:{cursor:'next'}});
 };
 const headers={};const res={setHeader(k,v){headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 try{await handler({headers:{}},res);assert.equal(res.code,200);assert.equal(res.body.clips.length,40);assert.equal(tokens,2);assert.equal(pages,3);assert(res.body.clips[0].createdAt);}
 finally{globalThis.fetch=originalFetch;process.env=originalEnv;}
});
test('API failure is not cached as an empty successful playlist',async()=>{
 const originalFetch=globalThis.fetch, originalEnv={...process.env};process.env.TWITCH_CLIENT_ID='test';process.env.TWITCH_CLIENT_SECRET='test';process.env.TWITCH_BROADCASTER_ID='test';delete process.env.KV_REST_API_URL;
 globalThis.fetch=async url=>String(url).includes('oauth2/token')?Response.json({access_token:'fake'}):new Response('',{status:503});
 const headers={};const res={setHeader(k,v){headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 try{await handler({headers:{}},res);assert.equal(res.code,502);assert.equal(headers['Cache-Control'],'no-store');}finally{globalThis.fetch=originalFetch;process.env=originalEnv;}
});
