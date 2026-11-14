import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../themes/cupcakemafiatv/static/js/wow-character.js',import.meta.url),'utf8');
const key='cmtv_wow_character_v1';
const snapshot=(extra={})=>({available:true,level:29,specialization:'Enhancement',artwork:null,updatedAt:new Date().toISOString(),...extra});
function visit({saved=null,builtAt='',reply=null,blocked=false,pending=false}={}){
 const elements={'[data-wow-level]':{textContent:'Level 29'},'.wow-spec-text':{},'.wow-spec-link img':{},'.wow-character-model img':{src:'/img/wow/cupcake-mafia.png',addEventListener(){}}};
 const attrs={'data-wow-updated-at':builtAt},storage=new Map(saved?[[key,JSON.stringify(saved)]]:[]);
 const card={querySelector:name=>elements[name],getAttribute:name=>attrs[name],setAttribute:(name,value)=>{attrs[name]=value;}};
 const context={document:{hidden:false,querySelector:()=>card,addEventListener(){}},Date,Number,JSON,URL,AbortSignal,setInterval(){},localStorage:{getItem:name=>{if(blocked)throw Error('blocked');return storage.get(name);},setItem:(name,value)=>{if(blocked)throw Error('blocked');storage.set(name,value);}},fetch:()=>pending?new Promise(()=>{}):reply?Promise.resolve({ok:true,json:async()=>reply}):Promise.reject(Error('offline'))};
 vm.runInNewContext(source,context);return {elements,storage,attrs};
}
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
test('a returning visit restores its newer level and spec before the request completes',()=>{
 const saved=snapshot({level:30,specialization:'Restoration'});const v=visit({saved,pending:true,builtAt:new Date(Date.now()-86400000).toISOString()});assert.equal(v.elements['[data-wow-level]'].textContent,'Level 30');assert.equal(v.elements['.wow-spec-text'].textContent,'Restoration Shaman');
});
test('older cached or upstream values cannot roll back a newer built-in or saved value',async()=>{
 const now=new Date().toISOString(),old=snapshot({level:14,updatedAt:new Date(Date.now()-86400000).toISOString()});const v=visit({saved:old,builtAt:now,reply:old});await settle();assert.equal(v.elements['[data-wow-level]'].textContent,'Level 29');
});
test('storage failures and malformed data retain the built-in value; valid refreshes save only public fields',async()=>{
 const blocked=visit({blocked:true,reply:snapshot({level:30,secret:'omit',artwork:'https://untrusted.example/asset.png'})});await settle();assert.equal(blocked.elements['[data-wow-level]'].textContent,'Level 30');
 for(const saved of [snapshot({level:-1}),snapshot({updatedAt:new Date(Date.now()-8*86400000).toISOString()}),snapshot({updatedAt:new Date(Date.now()+86400000).toISOString()})]){const v=visit({saved});await settle();assert.equal(v.elements['[data-wow-level]'].textContent,'Level 29');}
 const fresh=visit({reply:snapshot({level:30,secret:'omit',artwork:'https://untrusted.example/asset.png'})});await settle();const saved=JSON.parse(fresh.storage.get(key));assert.equal(saved.level,30);assert.equal(saved.secret,undefined);assert.equal(saved.artwork,null);
});
