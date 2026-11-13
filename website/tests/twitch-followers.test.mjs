import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/twitch-followers.js';
async function check(body,status=200){
 const original=fetch,env={...process.env};
 process.env.TWITCH_CLIENT_ID='followers-test';process.env.TWITCH_CLIENT_SECRET='test-secret';process.env.TWITCH_BROADCASTER_ID='test-channel';
 globalThis.fetch=async url=>String(url).includes('/oauth2/token')?Response.json({access_token:'test-token',expires_in:3600}):Response.json(body,{status});
 const response={headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.code=code;return this;},json(value){this.body=value;return this;}};
 try{await handler({method:'GET',headers:{}},response);return response;}finally{globalThis.fetch=original;process.env=env;}
}
test('Twitch upstream errors are unavailable instead of zero followers',async()=>{
 const response=await check({error:'Forbidden'},403);assert.equal(response.code,500);assert.equal(response.body.followerCount,undefined);assert(!JSON.stringify(response.body).includes('test-secret'));
});
test('zero followers is valid, while missing or malformed totals are unavailable',async()=>{
 assert.equal((await check({total:0})).body.followerCount,0);
 assert.equal((await check({total:670})).body.followerCount,670);
 for(const body of [{},{total:-1},{total:'670'},{total:null}])assert.equal((await check(body)).code,500);
});
