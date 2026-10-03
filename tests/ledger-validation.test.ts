import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { createLedger } from "../lib/ledger";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "svara-ledger-validation-"));
  const path = join(directory, "usage.sqlite");
  const ledger = createLedger(path);
  return { path, ledger, close() { ledger.close(); rmSync(directory, { recursive: true, force: true }); } };
}

for (const limit of [NaN, Infinity, -Infinity, -1, 10.5, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid allowance ${limit} cannot reserve provider spending`, () => {
    const f = fixture();
    try {
      assert.throws(() => f.ledger.reserve("attempt", "owner", "chat", 5, limit));
      assert.equal(f.ledger.total(), 0);
      f.ledger.reserve("attempt", "owner", "chat", 5, 10);
      assert.equal(f.ledger.total(), 5);
    } finally { f.close(); }
  });
}
for (const cost of [NaN, Infinity, -Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid reservation cost ${cost} cannot change the ledger`, () => {
    const f = fixture();
    try {
      assert.throws(() => f.ledger.reserve("attempt", "owner", "chat", cost, 100));
      assert.equal(f.ledger.total(), 0);
    } finally { f.close(); }
  });
}

test("zero allowance blocks calls and exact whole-cent capacity is usable", () => {
  const f = fixture();
  try {
    assert.throws(() => f.ledger.reserve("one", "owner", "chat", 5, 0), /exhausted/);
    f.ledger.reserve("one", "owner", "chat", 5, 5);
    assert.throws(() => f.ledger.reserve("two", "owner", "chat", 1, 5), /exhausted/);
    assert.equal(f.ledger.total(), 5);
  } finally { f.close(); }
});

test("a legacy negative reservation cannot subsidize new requests", () => {
  const f = fixture();
  try {
    const raw = new Database(f.path);
    raw.prepare("INSERT INTO operations VALUES (?,?,?,?,?,NULL)").run("legacy", "owner", "chat", -50, Date.now());
    raw.close();
    assert.throws(() => f.ledger.reserve("new", "owner", "chat", 5, 10), /ledger/i);
    assert.equal(f.ledger.total(), -50);
  } finally { f.close(); }
});

test("positive net balance cannot hide a legacy negative entry", () => {
  const f = fixture();
  try {
    const raw = new Database(f.path);
    const insert = raw.prepare("INSERT INTO operations VALUES (?,?,?,?,?,NULL)");
    insert.run("positive", "owner", "chat", 100, Date.now());
    insert.run("negative", "owner", "chat", -50, Date.now());
    raw.close();
    assert.throws(() => f.ledger.reserve("new", "owner", "chat", 5, 100), /ledger/i);
    assert.equal(f.ledger.total(), 50);
  } finally { f.close(); }
});

test("safe integer boundary cannot round an extra reservation into the allowance", () => {
  const f = fixture();
  try {
    f.ledger.reserve("one", "owner", "chat", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    assert.throws(() => f.ledger.reserve("two", "owner", "chat", 1, Number.MAX_SAFE_INTEGER), /exhausted/);
    assert.equal(f.ledger.total(), Number.MAX_SAFE_INTEGER);
  } finally { f.close(); }
});
