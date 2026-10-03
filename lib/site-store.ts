import { database, assets } from './storage';
export async function saveWebsite(id:string,owner:string,document:string){
 await assets().put(`websites/${id}.html`,document,{httpMetadata:{contentType:'text/html; charset=utf-8'}});
 await database().prepare('INSERT INTO websites(id,owner,published) VALUES(?,?,0)').bind(id,owner).run();
}
export async function publishWebsite(id:string,owner:string,publish:boolean){const r=await database().prepare('UPDATE websites SET published=? WHERE id=? AND owner=?').bind(publish?1:0,id,owner).run();return r.meta.changes===1;}
export async function publicWebsite(id:string){const r=await database().prepare('SELECT id FROM websites WHERE id=? AND published=1').bind(id).first();if(!r)return undefined;return (await assets().get(`websites/${id}.html`))?.text();}
