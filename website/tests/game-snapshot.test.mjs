import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {refreshGameSnapshot} from '../scripts/refresh-game-snapshot.mjs';
const current=(extra={})=>({available:true,level:29,specialization:'Enhancement',artwork:'https://render.worldofwarcraft.com/forever-us/character/example.png',updatedAt:new Date().toISOString(),...extra});
test('a publication refresh uses one cached endpoint and saves only public display fields',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'cmtv-game-'));let calls=0;
 try{const snapshot=await refreshGameSnapshot({dataDirectory:dir,fetchImpl:async url=>{calls++;assert.equal(url,'https://cupcakemafiatv-github-io.vercel.app/api/wow-character');return Response.json(current({secret:'omit',artwork:'https://untrusted.example/image.png'}));}});assert.equal(calls,1);assert.equal(snapshot.wow.level,29);assert.equal(snapshot.wow.artwork,null);assert.equal(snapshot.wow.secret,undefined);assert.equal(JSON.parse(await readFile(path.join(dir,'game_snapshot.json'),'utf8')).wow.level,29);}finally{await rm(dir,{recursive:true,force:true});}
});
test('outages, invalid data and older upstream snapshots preserve the original confirmed date and level',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'cmtv-game-'));const saved=current({updatedAt:new Date(Date.now()-3600000).toISOString()});
 try{for(const result of [null,{available:false},current({level:-1}),current({updatedAt:new Date(Date.now()+86400000).toISOString()}),current({level:14,updatedAt:new Date(Date.now()-7200000).toISOString()})]){await writeFile(path.join(dir,'game_snapshot.json'),JSON.stringify({wow:saved}));const snapshot=await refreshGameSnapshot({dataDirectory:dir,logger:{warn(){}},fetchImpl:async()=>{if(!result)throw Error('offline');return Response.json(result);}});assert.equal(snapshot.wow.level,29);assert.equal(snapshot.wow.updatedAt,saved.updatedAt);}}finally{await rm(dir,{recursive:true,force:true});}
});
