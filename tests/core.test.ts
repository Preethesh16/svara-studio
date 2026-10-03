import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLedger } from "../lib/ledger";
import { SSEDecoder } from "../lib/sse";
import { equal, identity, issue } from "../lib/auth";
test("split stream events preserve Unicode and DONE", () => {
  const s = new SSEDecoder();
  assert.deepEqual(s.push('data: {"text":"नम'), []);
  assert.deepEqual(s.push('स्ते"}\n\ndata: [DO'), ['{"text":"नमस्ते"}']);
  assert.deepEqual(s.push("NE]\n\n"), ["[DONE]"]);
});
test("durable shared ledger refuses overspend and duplicate operation", () => {
  const path = join(mkdtempSync(join(tmpdir(), "svara-")), "ledger.sqlite");
  const a = createLedger(path),
    b = createLedger(path);
  a.reserve("one", "owner", "image", 15, 20);
  assert.throws(() => b.reserve("two", "other", "image", 15, 20), /exhausted/);
  assert.throws(() => b.reserve("one", "owner", "image", 1, 20), /Duplicate/);
  a.close();
  b.close();
  const reopened = createLedger(path);
  assert.equal(reopened.total(), 15);
  reopened.bind("one", "voice");
  assert.equal(reopened.owns("other", "voice"), false);
  assert.equal(reopened.owns("owner", "voice"), true);
  reopened.close();
});
test("burst limit persists across connections", () => {
  const path = join(mkdtempSync(join(tmpdir(), "svara-")), "ledger.sqlite");
  const a = createLedger(path);
  for (let i = 0; i < 6; i++) a.reserve(String(i), "owner", "chat", 1, 100);
  assert.throws(() => a.reserve("7", "owner", "chat", 1, 100), /wait a minute/);
  a.close();
});
test("signed access cookie cannot be forged", () => {
  process.env.SESSION_SECRET = "test-secret-only";
  const cookie = issue();
  assert.ok(
    identity(
      new Request("https://example.test", {
        headers: { cookie: "svara=" + cookie },
      }),
    ),
  );
  assert.throws(() =>
    identity(
      new Request("https://example.test", {
        headers: { cookie: "svara=" + cookie + "f" },
      }),
    ),
  );
  assert.equal(equal("a", "aa"), false);
});

test("concurrent processes cannot over-reserve the allowance", async () => {
  const { spawn } = await import("node:child_process");
  const path = join(mkdtempSync(join(tmpdir(), "svara-race-")), "usage.sqlite");
  const init = createLedger(path);
  init.close();
  const source = new URL("../lib/ledger.ts", import.meta.url).href;
  const results = await Promise.all(
    Array.from(
      { length: 8 },
      (_, i) =>
        new Promise<number>((resolve) => {
          const code = `import {createLedger} from ${JSON.stringify(source)};const l=createLedger(${JSON.stringify(path)});try{l.reserve('${i}','owner','image',15,45);l.close();process.exit(0)}catch{l.close();process.exit(1)}`;
          const child = spawn(
            process.execPath,
            ["--import", "tsx", "--input-type=module", "-e", code],
            { stdio: "ignore" },
          );
          child.on("exit", (n) => resolve(n ?? 2));
        }),
    ),
  );
  assert.equal(results.filter((n) => n === 0).length, 3);
  const check = createLedger(path);
  assert.equal(check.total(), 45);
  check.close();
});
