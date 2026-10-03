import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function createLedger(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(
    `CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, owner TEXT NOT NULL, kind TEXT NOT NULL, cents INTEGER NOT NULL, created INTEGER NOT NULL, voice_id TEXT); CREATE TABLE IF NOT EXISTS attempts (owner TEXT NOT NULL, created INTEGER NOT NULL);`,
  );
  return {
    reserve: db.transaction(
      (
        id: string,
        owner: string,
        kind: string,
        cents: number,
        limit: number,
      ) => {
        if (db.prepare("SELECT id FROM operations WHERE id=?").get(id))
          throw new Error("Duplicate request. Start a new request explicitly.");
        const total = (
          db
            .prepare("SELECT COALESCE(SUM(cents),0) AS n FROM operations")
            .get() as { n: number }
        ).n;
        if (total + cents > limit)
          throw new Error("Demo allowance exhausted. No request was sent.");
        const recent = (
          db
            .prepare("SELECT COUNT(*) AS n FROM operations WHERE created>?")
            .get(Date.now() - 60000) as { n: number }
        ).n;
        if (recent >= 6)
          throw new Error(
            "Please wait a minute before starting another request.",
          );
        db.prepare("INSERT INTO operations VALUES (?,?,?,?,?,NULL)").run(
          id,
          owner,
          kind,
          cents,
          Date.now(),
        );
      },
    ).immediate,
    attempts: db.transaction((owner: string) => {
      db.prepare("DELETE FROM attempts WHERE created<?").run(
        Date.now() - 600000,
      );
      const count = (
        db
          .prepare("SELECT COUNT(*) AS n FROM attempts WHERE owner=?")
          .get(owner) as { n: number }
      ).n;
      if (count >= 15)
        throw new Error("Too many sign-in attempts. Wait ten minutes.");
      db.prepare("INSERT INTO attempts VALUES (?,?)").run(owner, Date.now());
    }).immediate,
    bind(id: string, voice: string) {
      db.prepare("UPDATE operations SET voice_id=? WHERE id=?").run(voice, id);
    },
    owns(owner: string, voice: string) {
      return !!db
        .prepare("SELECT id FROM operations WHERE owner=? AND voice_id=?")
        .get(owner, voice);
    },
    total() {
      return (
        db
          .prepare("SELECT COALESCE(SUM(cents),0) AS n FROM operations")
          .get() as { n: number }
      ).n;
    },
    close() {
      db.close();
    },
  };
}
let singleton: ReturnType<typeof createLedger>;
export function ledger() {
  return (singleton ??= createLedger(
    process.env.LEDGER_PATH || "./data/usage.sqlite",
  ));
}
