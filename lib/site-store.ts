import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
let db: Database.Database;
function store() {
  if (!db) {
    const path = process.env.LEDGER_PATH || "./data/usage.sqlite";
    mkdirSync(dirname(path), { recursive: true });
    db = new Database(path);
    db.pragma("journal_mode=WAL");
    db.pragma("busy_timeout=5000");
    db.exec(
      "CREATE TABLE IF NOT EXISTS websites (id TEXT PRIMARY KEY,owner TEXT NOT NULL,document TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 0)",
    );
  }
  return db;
}
export function saveWebsite(id: string, owner: string, document: string) {
  store()
    .prepare("INSERT INTO websites(id,owner,document) VALUES(?,?,?)")
    .run(id, owner, document);
}
export function publishWebsite(id: string, owner: string, publish: boolean) {
  const r = store()
    .prepare("UPDATE websites SET published=? WHERE id=? AND owner=?")
    .run(publish ? 1 : 0, id, owner);
  return r.changes === 1;
}
export function publicWebsite(id: string) {
  return (
    store()
      .prepare("SELECT document FROM websites WHERE id=? AND published=1")
      .get(id) as { document: string } | undefined
  )?.document;
}
