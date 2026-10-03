import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {Miniflare,createFetchMock} from 'miniflare';
test('real provider adapters work in Workers and refuse redirects',async()=>{
 const b=await build({stdin:{contents:`import {provider} from './lib/provider';import {POST} from './app/api/[...path]/route';import {issue} from './lib/auth';import {generateWebsite} from './lib/openai-website';import {websiteDocument} from './lib/website';export default {async fetch(req){try{if(new URL(req.url).pathname==='/voice')return POST(new Request('https://test/api/voice',{method:'POST',headers:{cookie:'svara='+issue()},body:JSON.stringify({requestId:'11111111-1111-4111-8111-111111111111',language:'hi-IN'})}));if(new URL(req.url).pathname==='/sanitize')return new Response(websiteDocument({title:'Test',description:'',html:'<main><h1>Demo</h1><img src="{{CAMPAIGN_IMAGE}}" alt="Missing poster"></main>',css:'',caption:'',whatsapp:''}));if(new URL(req.url).pathname==='/website')return Response.json(await generateWebsite('Demo cafe website without invented facts','test-id','owner',req.signal));const r=await provider('/v1/chat/completions',{messages:[]},req.signal);return new Response(r.body);}catch(e){return Response.json({error:e.message},{status:400});}}};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers','node:crypto'],write:false});
 const mock=createFetchMock();mock.disableNetConnect();
 const content={title:'Demo cafe',description:'A demo',html:'<main><h1>Demo café</h1><p>A fictional business.</p></main>',css:'body{color:#111}',caption:'Demo',whatsapp:'Demo'};
 mock.get('https://api.openai.com').intercept({path:'/v1/responses',method:'POST'}).reply(200,JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(content)}]}],usage:{total_tokens:100}}));
 mock.get('https://api.callmissed.com').intercept({path:'/v1/chat/completions',method:'POST'}).reply(200,'data: [DONE]\n\n');
 mock.get('https://api.callmissed.com').intercept({path:'/v1/chat/completions',method:'POST'}).reply(302,'Redirect refused');
 mock.get('https://api.callmissed.com').intercept({path:'/v1/voice/sessions',method:'POST'}).reply(200,JSON.stringify({id:'voice-test',ws_url:'wss://voice.example',token:'test-only'}));
 const mf=new Miniflare({modules:true,script:b.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{OPENAI_API_KEY:'test-only',CALLMISSED_API_KEY:'test-only',OPENAI_LIMIT_CENTS:'400',APP_LIMIT_CENTS:'500',LIVE_ENABLED:'true',SESSION_SECRET:'test-only'},fetchMock:mock});
 try{const db=await mf.getD1Database('DB');for(const sql of (await readFile('drizzle/0000_fair_slayback.sql','utf8')).split('--> statement-breakpoint'))await db.prepare(sql.trim()).run();
 const site=await mf.dispatchFetch('http://test/website');const d=await site.json();assert.equal(site.status,200,JSON.stringify(d));assert.equal(d.content.title,'Demo cafe');
 assert.doesNotMatch(await (await mf.dispatchFetch('http://test/sanitize')).text(),/<img/);
 const chat=await mf.dispatchFetch('http://test/chat');assert.equal(chat.status,200);assert.match(await chat.text(),/DONE/);
 const redirected=await mf.dispatchFetch('http://test/chat');assert.equal(redirected.status,400);assert.match((await redirected.json()).error,/302/);
 const voice=await mf.dispatchFetch('http://test/voice');const v=await voice.json();assert.equal(voice.status,200,JSON.stringify(v));assert.equal(v.maxDurationSeconds,180);assert.equal((await db.prepare("SELECT cents FROM operations WHERE kind='voice'").first()).cents,150);
 mock.assertNoPendingInterceptors();
 }finally{await mf.dispose();}
});
