import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { websiteDocument } from "../lib/website";
import { voiceDraftIntent } from "../lib/voice-draft";
import { generateWebsite } from "../lib/openai-website";
import { issue } from "../lib/auth";
import { POST } from "../app/api/website/route";
import { GET } from "../app/sites/[id]/route";
const content = {
  title: "Sample café",
  description: "A test business",
  html: "<main><h1>Sample café</h1><p>Fresh coffee.</p></main>",
  css: "body {color:#333;background:#fff}",
  caption: "A sample caption",
  whatsapp: "Sample promotional copy",
};
process.env.SESSION_SECRET = "website-test-secret";
process.env.LEDGER_PATH = join(
  mkdtempSync(join(tmpdir(), "svara-sites-")),
  "ledger.sqlite",
);
const cookie = issue();
const req = (data: unknown, token = cookie) =>
  new Request("http://localhost:3000/api/website", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: "svara=" + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
test("generated documents remove active content and remote resource loading", () => {
  const html = websiteDocument({
    ...content,
    title: "</title><script>bad()</script>",
    html: '<main><h1>Safe</h1><script>alert(1)</script><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)" onclick="bad()">Go</a><img src="https://evil.test/pixel"></main>',
    css: '@import "https://evil.test/a.css"; body{background:url(https://evil.test/pixel);color:red}',
  });
  assert.doesNotMatch(
    html,
    /<script|<iframe|onclick=|javascript:|https:\/\/evil\.test/,
  );
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /color:red/);
});
test("only an explicitly supplied inline campaign image is embedded", () => {
  const html = websiteDocument(
    {
      ...content,
      html: '<main><img src="{{CAMPAIGN_IMAGE}}" alt="Poster"></main>',
    },
    "data:image/png;base64,iVBORw0KGgo=",
  );
  assert.match(html, /data:image\/png;base64,iVBOR/);
});
test("English and Hindi voice requests route to drafts; negations and ordinary discussion do not", () => {
  assert.equal(
    voiceDraftIntent("Please generate an image for my café"),
    "image",
  );
  assert.equal(voiceDraftIntent("मेरी दुकान के लिए पोस्टर बनाओ"), "image");
  assert.equal(voiceDraftIntent("Build a website for my bakery"), "website");
  assert.equal(voiceDraftIntent("मुझे वेबसाइट चाहिए"), "website");
  assert.equal(voiceDraftIntent("Don't generate an image"), null);
  assert.equal(voiceDraftIntent("पोस्टर मत बनाओ"), null);
  assert.equal(voiceDraftIntent("I like this picture"), null);
});
test("missing OpenAI key fails before making any request", async () => {
  delete process.env.OPENAI_API_KEY;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return Response.json({});
  };
  await assert.rejects(
    () =>
      generateWebsite(
        "A business website",
        randomUUID(),
        "owner",
        new AbortController().signal,
      ),
    /server’s OpenAI key/,
  );
  assert.equal(calls, 0);
});
test("website generation, private preview, owner publishing and budget isolation", async () => {
  process.env.OPENAI_API_KEY = "mock-only";
  process.env.OPENAI_LIMIT_CENTS = "20";
  let calls = 0;
  global.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 6000);
    return Response.json({
      status: "completed",
      output: [
        { content: [{ type: "output_text", text: JSON.stringify(content) }] },
      ],
      usage: { total_tokens: 500 },
    });
  };
  const id = randomUUID();
  const r = await POST(
    req({
      action: "generate",
      requestId: id,
      brief: "Build a friendly neighborhood cafe website.",
    }),
  );
  assert.equal(r.status, 200);
  assert.match((await r.json()).document, /Sample café/);
  const publicReq = new Request("http://localhost:3000/sites/" + id);
  const params = { params: Promise.resolve({ id }) };
  assert.equal((await GET(publicReq, params)).status, 404);
  assert.equal(
    (await POST(req({ action: "publish", id, publish: true }, issue()))).status,
    404,
  );
  assert.equal(
    (await POST(req({ action: "publish", id, publish: true }))).status,
    200,
  );
  const published = await GET(publicReq, params);
  assert.equal(published.status, 200);
  assert.match(published.headers.get("content-security-policy")!, /sandbox/);
  assert.equal(
    (
      await POST(
        req({
          action: "generate",
          requestId: id,
          brief: "Build the same site again.",
        }),
      )
    ).status,
    400,
  );
  assert.equal(calls, 1);
  assert.equal(
    (await POST(req({ action: "publish", id, publish: false }))).status,
    200,
  );
  assert.equal((await GET(publicReq, params)).status, 404);
  global.fetch = async () => {
    calls++;
    return Response.json({ status: "incomplete" });
  };
  await assert.rejects(
    () =>
      generateWebsite(
        "test",
        randomUUID(),
        "owner",
        new AbortController().signal,
      ),
    /incomplete/,
  );
  await assert.rejects(
    () =>
      generateWebsite(
        "test",
        randomUUID(),
        "owner",
        new AbortController().signal,
      ),
    /allowance exhausted/,
  );
  assert.equal(calls, 2);
});
