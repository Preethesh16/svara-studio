import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { issue } from "../lib/auth";
import { POST } from "../app/api/[...path]/route";
process.env.SESSION_SECRET = "test-secret";
process.env.CALLMISSED_API_KEY = "test-only-secret";
process.env.LIVE_ENABLED = "true";
process.env.APP_LIMIT_CENTS = "80";
process.env.LEDGER_PATH = join(
  mkdtempSync(join(tmpdir(), "svara-route-")),
  "usage.sqlite",
);
const cookie = issue();
function request(path: string, body: unknown, authenticated = true) {
  return new Request("http://localhost:3000/api/" + path, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: authenticated ? "svara=" + cookie : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
test("routes reject anonymous, oversized and cross-origin requests before provider calls", async () => {
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return new Response("{}");
  };
  assert.equal(
    (await POST(request("chat", { requestId: randomUUID() }, false))).status,
    400,
  );
  assert.equal(
    (await POST(request("image", { prompt: "x".repeat(57000) }))).status,
    413,
  );
  const r = request("chat", {});
  r.headers.set("origin", "https://evil.test");
  assert.equal((await POST(r)).status, 403);
  assert.equal(calls, 0);
});
test("image success, duplicate suppression, ambiguous failure and exhausted budget", async () => {
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return Response.json({ data: [{ b64_json: "iVBORw0KGgo=" }] });
  };
  const id = randomUUID();
  const data = { requestId: id, prompt: "test" };
  const first = await POST(request("image", data));
  assert.equal(first.status, 200);
  assert.match((await first.json()).image, /^data:image\/png/);
  assert.equal((await POST(request("image", data))).status, 400);
  assert.equal(calls, 1);
  global.fetch = async () => {
    calls++;
    throw new Error("Ambiguous connection loss");
  };
  assert.equal(
    (await POST(request("image", { ...data, requestId: randomUUID() }))).status,
    400,
  );
  assert.equal(
    (await POST(request("image", { ...data, requestId: randomUUID() }))).status,
    400,
  );
  assert.equal(calls, 2);
});
test("chat streams and forwards cancellation; client cannot change the model", async () => {
  let captured: RequestInit | undefined;
  global.fetch = async (_url, options) => {
    captured = options;
    return new Response(
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n',
    );
  };
  const controller = new AbortController();
  const r = await POST(
    new Request(
      request("chat", {
        requestId: randomUUID(),
        model: "expensive-model",
        messages: [{ role: "user", content: "hello" }],
      }),
      { signal: controller.signal },
    ),
  );
  assert.equal(r.headers.get("content-type"), "text/event-stream");
  assert.match(await r.text(), /hello/);
  assert.ok(captured?.signal);
  controller.abort();
  assert.equal(captured?.signal?.aborted, true);
  assert.equal(JSON.parse(String(captured?.body)).model, "gemma-4-26b-a4b-it");
  assert.equal(JSON.parse(String(captured?.body)).max_tokens, 650);
});

test("voice minting uses bounded Sarvam settings and cleanup is owner-scoped", async () => {
  process.env.APP_LIMIT_CENTS = "200";
  const id = randomUUID();
  let options: RequestInit | undefined;
  global.fetch = async (_url, init) => {
    options = init;
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    return Response.json({
      id,
      ws_url: "wss://media.callmissed.test",
      token: "session-only-test-token",
      config: { llm_model: "sarvam-105b" },
    });
  };
  const r = await POST(
    request("voice", { requestId: randomUUID(), language: "hi-IN" }),
  );
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.token, "session-only-test-token");
  assert.equal(JSON.parse(String(options?.body)).max_duration_seconds, 60);
  assert.equal(JSON.parse(String(options?.body)).tts_model, "bulbul:v3");
  const foreign = request("end", { requestId: randomUUID(), id });
  foreign.headers.set("cookie", "svara=" + issue());
  assert.equal((await POST(foreign)).status, 404);
  assert.equal(
    (await POST(request("end", { requestId: randomUUID(), id }))).status,
    200,
  );
  assert.equal(options?.method, "DELETE");
});
