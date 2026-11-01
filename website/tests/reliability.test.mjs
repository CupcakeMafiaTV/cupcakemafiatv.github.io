import test from 'node:test';
import assert from 'node:assert/strict';
import twitchStatus from '../api/twitch-status.js';
import latestVideo from '../api/latest-video.js';
import { acquireLock, releaseLock } from '../api/_kv-lock.js';
import clipPost from '../api/post-new-clip.js';
import videoPost from '../api/post-new-video.js';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this},end(){return this}});
const request={method:'GET',headers:{}};
async function mocked(fn){const originalFetch=globalThis.fetch,originalEnv={...process.env};try{process.env.TWITCH_CLIENT_ID='fake';process.env.TWITCH_CLIENT_SECRET='fake';process.env.TWITCH_BROADCASTER_ID='fake';process.env.YouTube_Live_Checker='fake';process.env.CHANNEL_ID='fake';delete process.env.KV_REST_API_URL;delete process.env.KV_REST_API_TOKEN;await fn();}finally{globalThis.fetch=originalFetch;process.env=originalEnv}}

test('Twitch errors and malformed results are unknown, never confirmed offline',async()=>mocked(async()=>{
 for(const [status,body] of [[429,{error:'rate limit'}],[503,{error:'outage'}],[200,{unexpected:true}]]){
  globalThis.fetch=async url=>String(url).includes('oauth2/token')?Response.json({access_token:'fake'}):Response.json(body,{status});
  const res=response();await twitchStatus(request,res);assert.equal(res.code,502);assert.equal(res.body.isLive,null);assert.equal(res.body.available,false);assert.equal(res.headers['Cache-Control'],'no-store');
 }
}));
test('Confirmed empty Twitch results are offline; revoked tokens refresh before returning live',async()=>mocked(async()=>{
 globalThis.fetch=async url=>String(url).includes('oauth2/token')?Response.json({access_token:'fake'}):Response.json({data:[]});
 let res=response();await twitchStatus(request,res);assert.equal(res.code,200);assert.equal(res.body.isLive,false);
 let tokenCalls=0,streamCalls=0;globalThis.fetch=async url=>{if(String(url).includes('oauth2/token')){tokenCalls++;return Response.json({access_token:'fake'})}streamCalls++;return streamCalls===1?Response.json({}, {status:401}):Response.json({data:[{title:'Live',game_name:'League',viewer_count:10}]})};
 res=response();await twitchStatus(request,res);assert.equal(res.body.isLive,true);assert.equal(tokenCalls,2);assert.equal(streamCalls,2);
}));
const video=(id,extra={})=>({id,snippet:{title:'A regular video',liveBroadcastContent:'none',thumbnails:{}},contentDetails:{duration:'PT10M'},status:{privacyStatus:'public',embeddable:true},...extra});
test('YouTube searches past Shorts, skips non-playable uploads, and respects playlist order',async()=>mocked(async()=>{
 let pages=0;const ids=['aaaaaaaaaaa','bbbbbbbbbbb','ccccccccccc','ddddddddddd','eeeeeeeeeee'];
 globalThis.fetch=async url=>{const u=new URL(url);if(u.pathname.endsWith('/channels'))return Response.json({items:[{contentDetails:{relatedPlaylists:{uploads:'list'}}}]});
 if(u.pathname.endsWith('/playlistItems')){pages++;return Response.json(pages===1?{items:[{snippet:{resourceId:{videoId:'shortshort1'}}}],nextPageToken:'next'}:{items:ids.map(id=>({snippet:{resourceId:{videoId:id}}}))})}
 if(u.searchParams.get('id')==='shortshort1')return Response.json({items:[video('shortshort1',{contentDetails:{duration:'PT30S'}})]});
 return Response.json({items:[video(ids[4]),video(ids[3]),video(ids[2],{status:{privacyStatus:'public',embeddable:false}}),video(ids[1],{status:{privacyStatus:'private',embeddable:true}}),video(ids[0],{snippet:{title:'Live',liveBroadcastContent:'live'}})]});};
 const res=response();await latestVideo(request,res);assert.equal(res.code,200);assert.equal(res.body.videoId,ids[3]);assert.equal(pages,2);
}));
test('YouTube pagination is capped and a valid saved snapshot survives an upstream outage',async()=>mocked(async()=>{
 let pages=0;globalThis.fetch=async url=>{const u=new URL(url);if(u.pathname.endsWith('/channels'))return Response.json({items:[{contentDetails:{relatedPlaylists:{uploads:'list'}}}]});pages++;return Response.json({items:[],nextPageToken:'page-'+pages})};
 let res=response();await latestVideo(request,res);assert.equal(pages,5);assert.equal(res.code,404);assert.equal(res.headers['Cache-Control'],'no-store');
 process.env.KV_REST_API_URL='https://kv.invalid';process.env.KV_REST_API_TOKEN='fake';globalThis.fetch=async url=>String(url)==='https://kv.invalid'?Response.json({result:JSON.stringify({videoId:'abcdefghijk',title:'Saved video'})}):Response.json({error:'outage'},{status:503});
 res=response();await latestVideo(request,res);assert.equal(res.code,200);assert.equal(res.body.videoId,'abcdefghijk');assert.equal(res.body.stale,true);
}));
test('Late lock release cannot delete another worker lease; expired requests cannot perform work',async()=>mocked(async()=>{
 process.env.KV_REST_API_URL='https://kv.invalid';process.env.KV_REST_API_TOKEN='fake';let lock=null;
 globalThis.fetch=async(url,options)=>{const cmd=JSON.parse(options.body);if(cmd[0]==='SET'){if(lock)return Response.json({result:null});lock=cmd[2];return Response.json({result:'OK'})}if(cmd[0]==='EVAL'){const owned=lock===cmd[4];if(owned)lock=null;return Response.json({result:owned?1:0})}throw Error('Unexpected request')};
 const a=await acquireLock('test');assert(a);assert.equal(await acquireLock('test'),null);lock=null;const b=await acquireLock('test');assert.notEqual(a.token,b.token);await releaseLock(a);assert.equal(lock,b.token);await releaseLock(b);assert.equal(lock,null);
 assert.throws(()=>a.request.assertTime(60000),/time budget/);
 Object.defineProperty(a.signal, 'aborted', {value:true});
 assert.throws(()=>a.request('https://must-not-be-contacted.invalid'),/time budget/);
}));
test('Authenticated clip job passes its bounded request through posting and persistence',async()=>mocked(async()=>{
 Object.assign(process.env,{CRON_SECRET:'fake-secret',KV_REST_API_URL:'https://kv.invalid',KV_REST_API_TOKEN:'fake',DISCORD_WEBHOOK_URL:'https://discord.invalid'});
 let stored=false,posted=0,released=false;
 globalThis.fetch=async(url,options={})=>{
  const u=String(url);assert(options.signal,'Every request must be bounded');
  if(u==='https://kv.invalid'){const cmd=JSON.parse(options.body);if(cmd[0]==='SET')return Response.json({result:'OK'});if(cmd[0]==='EVAL'){released=true;return Response.json({result:1})}}
  if(u.endsWith('/get/last-posted-clip'))return Response.json({result:JSON.stringify({lastClipId:'old',lastCreatedAt:'2026-01-01T00:00:00Z'})});
  if(u.includes('/get/twitch-access-token'))return Response.json({result:null});
  if(u.includes('/set/')){if(u.includes('last-posted-clip'))stored=true;return Response.json({result:'OK'})}
  if(u.includes('oauth2/token'))return Response.json({access_token:'fake'});
  if(u.includes('/helix/clips'))return Response.json({data:[{id:'new',created_at:'2026-01-02T00:00:00Z',title:'Clip',url:'https://clips.twitch.tv/new'}]});
  if(u==='https://discord.invalid'){posted++;return new Response(null,{status:204})}
  throw Error('Unexpected mocked URL');
 };
 const res=response();await clipPost({method:'GET',headers:{authorization:'Bearer fake-secret'}},res);assert.equal(res.code,200);assert.equal(res.body.posted,1);assert.equal(posted,1);assert(stored);assert(released);
}));
test('Video and VOD jobs prime state without sending old uploads as new posts',async()=>mocked(async()=>{
 Object.assign(process.env,{CRON_SECRET:'fake-secret',KV_REST_API_URL:'https://kv.invalid',KV_REST_API_TOKEN:'fake',DISCORD_VIDEOS_WEBHOOK_URL:'https://videos.invalid',DISCORD_VODS_WEBHOOK_URL:'https://vods.invalid'});
 let writes=0,released=false;globalThis.fetch=async(url,options)=>{assert(options.signal);const u=String(url);if(u==='https://kv.invalid'){const cmd=JSON.parse(options.body);if(cmd[0]==='EVAL')released=true;return Response.json({result:cmd[0]==='SET'?'OK':1})}if(u.includes('/get/'))return Response.json({result:null});if(u.includes('/set/')){writes++;return Response.json({result:'OK'})}throw Error('No external service should be contacted while priming')};
 const res=response();await videoPost({method:'GET',headers:{authorization:'Bearer fake-secret'},query:{force:'1'}},res);assert.equal(res.body.video.primed,true);assert.equal(res.body.vod.primed,true);assert.equal(writes,2);assert(released);
}));

test('Video and VOD jobs post only new items and persist each feed through the leased request',async()=>mocked(async()=>{
 Object.assign(process.env,{CRON_SECRET:'fake-secret',KV_REST_API_URL:'https://kv.invalid',KV_REST_API_TOKEN:'fake',DISCORD_VIDEOS_WEBHOOK_URL:'https://videos.invalid',DISCORD_VODS_WEBHOOK_URL:'https://vods.invalid'});
 const posts=[],saved=[];
 globalThis.fetch=async(url,options={})=>{
  assert(options.signal);const u=new URL(url);
  if(u.origin==='https://kv.invalid'){
   if(u.pathname==='/'){const command=JSON.parse(options.body);return Response.json({result:command[0]==='SET'?'OK':1})}
   if(u.pathname.startsWith('/get/'))return Response.json({result:JSON.stringify({lastId:'old',lastPublishedAt:'2026-01-01T00:00:00Z'})});
   if(u.pathname.startsWith('/set/')){saved.push(u.pathname);return Response.json({result:'OK'})}
  }
  if(u.origin==='https://videos.invalid'||u.origin==='https://vods.invalid'){posts.push(u.origin);return new Response(null,{status:204})}
  if(u.pathname.endsWith('/channels'))return Response.json({items:[{contentDetails:{relatedPlaylists:{uploads:u.searchParams.has('forHandle')?'vods':'videos'}}}]});
  if(u.pathname.endsWith('/playlistItems'))return Response.json({items:[{snippet:{title:'Upload',publishedAt:'2026-01-02T00:00:00Z',resourceId:{videoId:'abcdefghijk'},thumbnails:{high:{url:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'}}}}]});
  if(u.pathname.endsWith('/videos'))return Response.json({items:[{id:'abcdefghijk',snippet:{title:'Upload',publishedAt:'2026-01-02T00:00:00Z',liveBroadcastContent:'none',thumbnails:{high:{url:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'}}},contentDetails:{duration:'PT10M'}}]});
  throw Error('Unexpected mock request');
 };
 const res=response();await videoPost({method:'GET',headers:{authorization:'Bearer fake-secret'},query:{force:'1'}},res);
 assert.equal(res.body.video.posted,1);assert.equal(res.body.vod.posted,1);assert.equal(posts.length,2);assert.equal(saved.length,2);
}));
