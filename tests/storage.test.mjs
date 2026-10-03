import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Run the actual storage adapters in a local Worker with real D1/R2 emulation.
// No API keys, network model calls, or production bindings are used.
test('Worker storage enforces concurrent allowances, ownership and publication', async () => {
 const bundle=await build({stdin:{contents:`
 import { createLedger } from './lib/ledger';
 import { saveWebsite,publishWebsite,publicWebsite } from './lib/site-store';
 export default {async fetch(req){const p=await req.json();try {
 const l=createLedger(p.bucket);
 if(p.action==='reserve')await l.reserve(p.id,p.owner||'owner','test',p.cents,p.limit);
 if(p.action==='bind')await l.bind(p.id,p.voice);
 if(p.action==='owns')return Response.json(await l.owns(p.owner,p.voice));
 if(p.action==='total')return Response.json(await l.total());
 if(p.action==='login')await l.attempts(p.owner);
 if(p.action==='save')await saveWebsite(p.id,p.owner,p.document);
 if(p.action==='publish')return Response.json(await publishWebsite(p.id,p.owner,p.publish));
 if(p.action==='read')return Response.json((await publicWebsite(p.id))??null);
 return Response.json(true);
 }catch(e){return Response.json({error:e.message},{status:400});}}};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers'],write:false});
 const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['ASSETS_BUCKET']});
 try {
  const db=await mf.getD1Database('DB');
  const migration=await readFile(new URL('../drizzle/0000_fair_slayback.sql',import.meta.url),'utf8');
  for(const sql of migration.split('--> statement-breakpoint'))await db.prepare(sql.trim()).run();
  const call=(body)=>mf.dispatchFetch('http://storage.test/',{method:'POST',body:JSON.stringify(body)});
  const requests=await Promise.all(Array.from({length:12},(_,i)=>call({action:'reserve',id:`request-${i}`,bucket:'callmissed',cents:5,limit:15})));
  assert.equal(requests.filter(r=>r.ok).length,3,'concurrent requests cannot overspend');
  assert.equal(await (await call({action:'total',bucket:'callmissed'})).json(),15);
  assert.equal((await call({action:'reserve',id:'openai-request',bucket:'openai',cents:10,limit:10})).status,200,'provider allowances are separate');
  assert.equal((await call({action:'reserve',id:'openai-request',bucket:'openai',cents:10,limit:100})).status,400,'duplicate request cannot spend again');
  const rate=await Promise.all(Array.from({length:8},(_,i)=>call({action:'reserve',id:`burst-${i}`,bucket:'rate-test',cents:1,limit:100})));
  assert.equal(rate.filter(r=>r.ok).length,6);
  await call({action:'bind',id:'openai-request',bucket:'openai',voice:'voice-owned'});
  assert.equal(await (await call({action:'owns',bucket:'openai',owner:'other',voice:'voice-owned'})).json(),false);
  assert.equal(await (await call({action:'owns',bucket:'openai',owner:'owner',voice:'voice-owned'})).json(),true);
  const signins=await Promise.all(Array.from({length:18},()=>call({action:'login',owner:'login-test'})));
  assert.equal(signins.filter(r=>r.ok).length,15);
  assert.equal((await call({action:'save',id:'page-test',owner:'author',document:'<!doctype html><h1>Test page</h1>'})).status,200);
  assert.equal(await (await call({action:'read',id:'page-test'})).json(),null,'new pages remain private');
  assert.equal(await (await call({action:'publish',id:'page-test',owner:'other',publish:true})).json(),false);
  assert.equal(await (await call({action:'publish',id:'page-test',owner:'author',publish:true})).json(),true);
  assert.match(await (await call({action:'read',id:'page-test'})).json(),/Test page/);
  await call({action:'publish',id:'page-test',owner:'author',publish:false});
  assert.equal(await (await call({action:'read',id:'page-test'})).json(),null);
 } finally {await mf.dispose();}
});
