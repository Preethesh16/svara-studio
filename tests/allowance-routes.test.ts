import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { issue } from "../lib/auth";
import { ledger } from "../lib/ledger";
import { GET, POST } from "../app/api/[...path]/route";
import { generateWebsite, websiteEnabled } from "../lib/openai-website";

const directory = mkdtempSync(join(tmpdir(), "svara-allowance-routes-"));
process.env.LEDGER_PATH = join(directory, "usage.sqlite");
process.env.SESSION_SECRET = "test-allowance-session";
process.env.CALLMISSED_API_KEY = "test-provider-key";
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.LIVE_ENABLED = "true";
const cookie = issue();
function request(method = "POST") {
  return new Request("http://localhost:3000/api/chat", {
    method,
    headers: { host: "localhost:3000", origin: "http://localhost:3000", cookie: `svara=${cookie}` },
    ...(method === "POST" ? { body: JSON.stringify({ requestId: randomUUID(), messages: [{ role: "user", content: "hello" }] }) } : {}),
  });
}
after(() => { ledger().close(); rmSync(directory, { recursive: true, force: true }); });

for (const configured of ["not-a-number", "NaN", "Infinity", "-1", "10.5", "9007199254740992"]) {
  test(`invalid configured allowance ${configured} sends no provider request`, async (t) => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({}); });
    process.env.APP_LIMIT_CENTS = configured;
    process.env.OPENAI_LIMIT_CENTS = configured;
    assert.equal((await POST(request())).status, 400);
    assert.equal((await GET(request("GET"))).status, 503);
    assert.equal(websiteEnabled(), false);
    await assert.rejects(generateWebsite("test brief", randomUUID(), "owner", new AbortController().signal));
    assert.equal(calls, 0);
    assert.equal(ledger().total(), 0);
  });
}

test("status reports the effective cap and zero allowance disables live calls", async () => {
  process.env.APP_LIMIT_CENTS = "2000";
  const status = await (await GET(request("GET"))).json();
  assert.equal(status.limitCents, 1500);
  assert.equal(status.enabled, true);
  process.env.APP_LIMIT_CENTS = "0";
  assert.equal((await (await GET(request("GET"))).json()).enabled, false);
});

test("valid allowance still permits exactly one mocked chat reservation", async (t) => {
  process.env.APP_LIMIT_CENTS = "5";
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response("data: [DONE]\n\n"); });
  assert.equal((await POST(request())).status, 200);
  assert.equal((await POST(request())).status, 400);
  assert.equal(calls, 1);
  assert.equal(ledger().total(), 5);
});
