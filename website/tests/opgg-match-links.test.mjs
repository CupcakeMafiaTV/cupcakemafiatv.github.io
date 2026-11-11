import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchLinks,parseLadderRank} from '../api/_opgg-match-links.js';
import handler from '../api/_opgg-match-handler.js';
const profile='https://op.gg/lol/summoners/na/CupcakeMafia-NA1';
const id='eq3KyFixtgUMkbs_jOy8RKm6uY6hSUE9gxtrDS9thuM=';
const game=(overrides={})=>({startTime:'2026-11-05T23:00:04-05:00',additionalProperty:Object.entries({matchId:id,queueType:'SOLORANKED',champion:'Ahri',result:'LOSE',...overrides}).map(([name,value])=>({name,value}))});
const html=games=>'<script type="application/ld+json">'+JSON.stringify({'@graph':[{'@id':profile+'#recent-games',itemListElement:games.map(item=>({item}))}]})+'</script>';
test('Ahri identifier matches the supplied exact-game URL',()=>{
 const [match]=parseMatchLinks(html([game()]));
 assert.equal(match.url,profile+'/matches/'+id.replace('=','%3D')+'/1793937604000');
 assert.equal(match.champion,'Ahri');assert.equal(match.result,'L');
});
test('Rejects other queues, malformed identifiers, wrong profiles, and broken structured data',()=>{
 assert.deepEqual(parseMatchLinks(html([game({queueType:'FLEXRANKED'}),game({matchId:'https://evil.example/'}),game({champion:'<script>'})])),[]);
 assert.deepEqual(parseMatchLinks(html([game()]).replace(profile,profile+'-other')),[]);
 assert.deepEqual(parseMatchLinks('<script type="application/ld+json">{oops}</script>'),[]);
});
test('Resolver reuses cached identifiers without any Riot requests',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async url=>{calls++;assert.equal(url,profile+'?queue_type=SOLORANKED');return new Response(html([game()]));};
 const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){return this;}});
 try{const a=response(),b=response();await handler({method:'GET',headers:{}},a);await handler({method:'GET',headers:{}},b);assert.equal(calls,1);assert.equal(a.body.matches.length,1);assert.deepEqual(a.body,b.body);}finally{globalThis.fetch=original;}
});

test('Parses NA percentile only from the visible ladder link',()=>{
 const link=(text,region='na')=>`<a href="/lol/leaderboards/tier?region=${region}">${text}</a>`;
 assert.deepEqual(parseLadderRank(link('Ladder Rank <span>22,692</span> (1.38% of top)')),{rank:22692,topPercent:1.38,region:'NA'});
 for(const text of ['Ladder Rank 0 (1.38% of top)','Ladder Rank 1 (101% of top)','Ladder Rank 1 (0% of top)','Ladder Rank unavailable'])assert.equal(parseLadderRank(link(text)),null);
 assert.equal(parseLadderRank(link('Ladder Rank 22,692 (1.38% of top)','euw')),null);
 assert.equal(parseLadderRank('<script>"Ladder Rank 22,692 (1.38% of top)"</script>'),null);
});

test('Normalizes Twisted Fate to the Riot champion identifier',()=>{assert.equal(parseMatchLinks(html([game({champion:'Twisted Fate'})]))[0].champion,'TwistedFate');});

test('A percentile-only page refreshes independently; concurrent visitors share the request',async()=>{
 const {default:resolve}=await import('../api/_opgg-match-handler.js?percentile-only');
 const original=fetch,env={...process.env};delete process.env.KV_REST_API_URL;delete process.env.KV_REST_API_TOKEN;
 let calls=0,release;const gate=new Promise(done=>{release=done});
 globalThis.fetch=async()=>{calls++;await gate;return new Response('<a href="/lol/leaderboards/tier?region=na">Ladder Rank 22,729 (1.38% of top)</a>')};
 const response=()=>({setHeader(){},status(){return this},json(body){this.body=body;return this}});
 try{const a=response(),b=response();const first=resolve({method:'GET',headers:{}},a),second=resolve({method:'GET',headers:{}},b);release();await Promise.all([first,second]);assert.equal(calls,1);assert.equal(a.body.ladder.rank,22729);assert.equal(a.body.matches.length,0);assert.deepEqual(a.body,b.body);assert.equal(a.body.stale,false)}finally{globalThis.fetch=original;process.env=env}
});
test('A saved percentile and its original timestamp survive an upstream outage',async()=>{
 const {default:resolve}=await import('../api/_opgg-match-handler.js?outage');
 const original=fetch,env={...process.env};process.env.KV_REST_API_URL='https://kv.invalid';process.env.KV_REST_API_TOKEN='test';
 const updatedAt=new Date(Date.now()-3600000).toISOString(),ladder={rank:22729,topPercent:1.38,region:'NA',updatedAt};
 globalThis.fetch=async url=>String(url)==='https://kv.invalid'?Response.json({result:JSON.stringify({matches:[],ladder,updatedAt})}):new Response('',{status:503});
 const response={setHeader(){},status(){return this},json(body){this.body=body;return this}};
 try{await resolve({method:'GET',headers:{}},response);assert.deepEqual(response.body.ladder,ladder);assert.equal(response.body.stale,true)}finally{globalThis.fetch=original;process.env=env}
});
