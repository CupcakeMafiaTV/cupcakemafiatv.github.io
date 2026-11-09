import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchLinks} from '../api/_opgg-match-links.js';
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
