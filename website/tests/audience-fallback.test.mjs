import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile(new URL('../themes/cupcakemafiatv/static/js/audience-bar.js',import.meta.url),'utf8');
async function simulate(values={},cached={},storageBlocked=false){
 const elements=Object.fromEntries(['youtube-sub-count','twitch-follower-count','discord-member-count'].map(id=>[id,{id,dataset:{},textContent:'loading',removeAttribute(){}}]));
 const band={querySelector:selector=>elements[selector.slice(1)],querySelectorAll:()=>Object.values(elements),setAttribute(name,value){this[name]=value}};
 const context={document:{querySelector:()=>band},Intl,AbortController,setTimeout,clearTimeout,localStorage:{getItem(key){if(storageBlocked)throw Error('blocked');return cached[key]??null},setItem(){}},fetch:async url=>{const entry=Object.entries(values).find(([key])=>url.endsWith(key));if(!entry)throw Error('offline');return {ok:true,json:async()=>entry[1]}}};
 await vm.runInNewContext(script,context);return {elements,band};
}
test('First-visit outages and blocked storage finish loading with an honest fallback',async()=>{
 for(const blocked of [false,true]){const {elements,band}=await simulate({}, {},blocked);assert.equal(band['aria-busy'],'false');for(const element of Object.values(elements)){assert.equal(element.textContent,'—');assert.equal(element.title,'Count temporarily unavailable')}}
});
test('A service outage preserves saved counts while other services update, including a real zero',async()=>{
 const {elements}=await simulate({'subscribers':{subscriberCount:0},'discord-widget':{memberCount:76}},{cmtv_twitch_followers:'670'});
 assert.equal(elements['youtube-sub-count'].textContent,'0');assert.equal(elements['twitch-follower-count'].textContent,'670');assert.equal(elements['discord-member-count'].textContent,'76');
});
