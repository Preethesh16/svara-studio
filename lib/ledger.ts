import { database } from './storage';
export function createLedger(bucket='callmissed') {
 return {
 async reserve(id:string,owner:string,kind:string,cents:number,limit:number) {
  if(!Number.isFinite(limit)||limit<0||!Number.isFinite(cents)||cents<=0) throw new Error('Spending allowance is unavailable.');
  // One conditional INSERT is atomic across concurrent requests. Never reset the deployed ledger.
  const r=await database().prepare(`INSERT INTO operations(id,owner,kind,bucket,cents,created)
  SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM operations WHERE id=?)
  AND (SELECT COALESCE(SUM(cents),0) FROM operations WHERE bucket=?)+?<=?
  AND (SELECT COUNT(*) FROM operations WHERE bucket=? AND created>?)<6`).bind(id,owner,kind,bucket,cents,Date.now(),id,bucket,cents,limit,bucket,Date.now()-60000).run();
  if(!r.meta.changes) throw new Error('Request already used, allowance exhausted, or rate limit reached. No API request was sent.');
 },
 async attempts(owner:string){
 const now=Date.now();const results=await database().batch([
 database().prepare('DELETE FROM attempts WHERE created<?').bind(now-600000),
 database().prepare('INSERT INTO attempts(owner,created) SELECT ?,? WHERE (SELECT COUNT(*) FROM attempts WHERE owner=?)<15').bind(owner,now,owner)]);
 if(!results[1].meta.changes) throw new Error('Too many sign-in attempts. Wait ten minutes.');
 },
 async bind(id:string,voice:string){await database().prepare('UPDATE operations SET voice_id=? WHERE id=? AND bucket=?').bind(voice,id,bucket).run();},
 async owns(owner:string,voice:string){return !!await database().prepare('SELECT id FROM operations WHERE owner=? AND voice_id=? AND bucket=?').bind(owner,voice,bucket).first();},
 async total(){const r=await database().prepare('SELECT COALESCE(SUM(cents),0) AS n FROM operations WHERE bucket=?').bind(bucket).first<{n:number}>();return r?.n||0;}
 };
}
export function ledger(){return createLedger();}
