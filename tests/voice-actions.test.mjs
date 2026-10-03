import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
const b=await build({entryPoints:['lib/voice-actions.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {VoiceCommands}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
test('spoken requests execute once, preserve details and support Hinglish',()=>{
 const c=new VoiceCommands();
 assert.equal(c.accept('a','Kya aap mere ko ek billi ka image generate karke de sakte hain kya?',true).kind,'image');
 assert.equal(c.accept('a','Kya aap mere ko ek billi ka image generate karke de sakte hain kya?',true),null);
 assert.equal(c.accept('b','I can generate a website',false),null);
 assert.equal(c.accept('c','Can you create a website for a vegetable shop for me?',true).kind,'website');
 assert.equal(c.accept('d','Simple Catalog',true),null);c.accept('e','Just vegetables',true);c.accept('f','Local people walking in',true);
 const a=c.accept('g','Do it immediately fast fast fast',true);assert.equal(a.kind,'website');assert.match(a.brief,/Simple Catalog/);assert.match(a.brief,/Just vegetables/);assert.match(a.brief,/Local people/);
 assert.equal(c.accept('h','Do it now',true),null,'repeated go-ahead without changes does not spend twice');
 assert.equal(c.accept('i','try again',true).kind,'website');
 assert.equal(c.accept('j','do not generate a website',true).cancel,true);
});
test('website editor refinements stay in website context',()=>{const c=new VoiceCommands(['Build a website for a vegetable shop']);const a=c.accept('a','make it green',true);assert.equal(a.kind,'website');assert.match(a.brief,/vegetable shop/);assert.match(a.brief,/make it green/);assert.equal(c.accept('b','make it green',true),null);});
