import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../themes/cupcakemafiatv/static/js/solo-rank.js',import.meta.url),'utf8');
const key='cmtv_solo_rank_v1';
const snapshot=(extra={})=>({available:true,stale:false,rank:{tier:'DIAMOND',division:'I',leaguePoints:30,wins:470,losses:469},updatedAt:new Date(Date.now()-300000).toISOString(),recentMatches:[{champion:'Ahri',result:'W',playedAt:Date.now()-900000}],...extra});
function element(){return{textContent:'',hidden:true,children:[],attrs:{},setAttribute(name,value){this.attrs[name]=value;},replaceChildren(...children){this.children=children;},append(...children){this.children.push(...children);},addEventListener(){}};}
async function visit({storage={},reply=snapshot(),offline=false,blocked=false}={}){
 const values=new Map(Object.entries(storage));
 const ids=['card','name','lp','wins','losses','wr','emblem','recent','status'].map(id=>['solo-rank-'+id,element()]);
 const elements=Object.fromEntries(ids);elements['solo-rank-name'].textContent='Checking rank…';
 let requests=0;
 const context={document:{hidden:false,getElementById:id=>elements[id]||null,createElement:element,addEventListener(){}},Intl,Date,Number,JSON,Map,AbortSignal,setInterval(){},localStorage:{getItem(name){if(blocked)throw Error('blocked');return values.get(name)||null;},setItem(name,value){if(blocked)throw Error('blocked');values.set(name,value);}},fetch:async url=>{requests++;if(offline)throw Error('offline');return{ok:true,json:async()=>String(url).includes('match-links')?{matches:[]}:reply};}};
 vm.runInNewContext(source,context);
 for(let turn=0;turn<8;turn++)await new Promise(resolve=>setImmediate(resolve));
 return{elements,values,requests};
}
test('a successful visit stores only the confirmed rank, results and original time',async()=>{
 const data=snapshot({secret:'not-for-storage'});const {elements,values,requests}=await visit({reply:data});
 const saved=JSON.parse(values.get(key));assert.deepEqual(saved.rank,data.rank);assert.equal(saved.updatedAt,data.updatedAt);assert.equal(saved.secret,undefined);assert.equal(elements['solo-rank-status'].hidden,true);assert.equal(requests,3);
});
test('a later offline visit restores the emblem, LP and results with a last-confirmed label',async()=>{
 const saved=snapshot();const {elements,values}=await visit({storage:{[key]:JSON.stringify(saved)},offline:true});
 assert.equal(elements['solo-rank-name'].textContent,'Diamond I');assert.equal(elements['solo-rank-lp'].textContent,30);assert.equal(elements['solo-rank-emblem'].hidden,false);assert.equal(elements['solo-rank-card'].attrs['data-rank-tier'],'DIAMOND');assert.equal(elements['solo-rank-recent'].children.length,1);assert.equal(elements['solo-rank-status'].hidden,false);assert.match(elements['solo-rank-status'].title,/confirmed/);assert.equal(JSON.parse(values.get(key)).updatedAt,saved.updatedAt);
});
test('fresh data replaces a saved rank and removes the indicator, including real zero LP',async()=>{
 const fresh=snapshot({rank:{tier:'MASTER',division:'I',leaguePoints:0,wins:471,losses:469}});
 const {elements,values}=await visit({storage:{[key]:JSON.stringify(snapshot())},reply:fresh});assert.equal(elements['solo-rank-name'].textContent,'Master');assert.equal(elements['solo-rank-lp'].textContent,0);assert.equal(elements['solo-rank-card'].attrs['data-rank-tier'],'MASTER');assert.equal(elements['solo-rank-status'].hidden,true);assert.equal(JSON.parse(values.get(key)).rank.tier,'MASTER');
});
test('corrupt, expired, future-dated and invalid saved ranks are not shown as confirmed',async()=>{
 const invalid=['{',JSON.stringify(snapshot({updatedAt:new Date(Date.now()-8*86400000).toISOString()})),JSON.stringify(snapshot({updatedAt:new Date(Date.now()+86400000).toISOString()})),JSON.stringify(snapshot({rank:{tier:'FAKE',division:'I',leaguePoints:5,wins:1,losses:0}})),JSON.stringify(snapshot({rank:{tier:'MASTER',division:'I',leaguePoints:-1,wins:1,losses:0}}))];
 for(const saved of invalid){const{elements}=await visit({storage:{[key]:saved},offline:true});assert.equal(elements['solo-rank-name'].textContent,'Rank temporarily unavailable');assert.equal(elements['solo-rank-emblem'].hidden,true);}
});
test('blocked browser storage preserves fresh display and honest offline fallback',async()=>{
 const healthy=await visit({blocked:true});assert.equal(healthy.elements['solo-rank-name'].textContent,'Diamond I');const offline=await visit({blocked:true,offline:true});assert.equal(offline.elements['solo-rank-name'].textContent,'Rank temporarily unavailable');
});
test('server fallback retains its original confirmation time and stale label',async()=>{
 const saved=snapshot({stale:true});const{elements,values}=await visit({reply:saved});assert.equal(elements['solo-rank-status'].hidden,false);assert.equal(JSON.parse(values.get(key)).updatedAt,saved.updatedAt);
});
