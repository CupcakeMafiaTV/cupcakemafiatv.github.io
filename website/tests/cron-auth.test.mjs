import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeCron } from '../api/_cron-auth.js';
import clipHandler from '../api/post-new-clip.js';
import videoHandler from '../api/post-new-video.js';

const response = () => ({ headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(code) { this.code=code; return this; }, json(body) { this.body=body; return this; } });

test('Cron authentication fails closed, restricts methods and accepts only the matching bearer token', () => {
  const oldSecret=process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    let res=response(); assert.equal(authorizeCron({method:'GET',headers:{}},res),false); assert.equal(res.code,503);
    process.env.CRON_SECRET='unit-test-secret';
    for (const authorization of [undefined, '', 'Bearer wrong', 'Bearer unit-test-secrex', ['Bearer unit-test-secret'], 'Bearer ?nit-test-secret']) {
      res=response(); assert.equal(authorizeCron({method:'GET',headers:{authorization}},res),false); assert.equal(res.code,401); assert.equal(res.headers['Cache-Control'],'no-store');
    }
    res=response(); assert.equal(authorizeCron({method:'POST',headers:{authorization:'Bearer unit-test-secret'}},res),false); assert.equal(res.code,405); assert.equal(res.headers.Allow,'GET');
    res=response(); assert.equal(authorizeCron({method:'GET',headers:{authorization:'Bearer unit-test-secret'}},res),true); assert.equal(res.code,undefined);
  } finally { if(oldSecret===undefined)delete process.env.CRON_SECRET; else process.env.CRON_SECRET=oldSecret; }
});

test('Both posting handlers reject unauthenticated calls before any fetch, including force requests', async () => {
  const oldSecret=process.env.CRON_SECRET, originalFetch=globalThis.fetch; let calls=0;
  globalThis.fetch=async()=>{calls++; throw Error('A rejected request must never contact an external service');};
  try {
    for(const secret of [undefined,'test-secret']) {
      if(secret===undefined)delete process.env.CRON_SECRET; else process.env.CRON_SECRET=secret;
      for(const handler of [clipHandler, videoHandler]) {
        const res=response(); await handler({method:'GET',headers:{},query:{force:'1'}},res);
        assert.equal(res.code,secret?401:503);
      }
    }
    assert.equal(calls,0);
  } finally { globalThis.fetch=originalFetch; if(oldSecret===undefined)delete process.env.CRON_SECRET; else process.env.CRON_SECRET=oldSecret; }
});
