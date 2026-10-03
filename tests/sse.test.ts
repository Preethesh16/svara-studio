import test from "node:test";
import assert from "node:assert/strict";
import { SSEDecoder, readSSE } from "../lib/sse";

for (const ending of ["\n", "\r\n", "\r"]) {
  test(`data framing survives every chunk boundary with ${JSON.stringify(ending)} endings`, () => {
    const source = `data: नमस्ते${ending}data: world${ending}${ending}data: [DONE]${ending}${ending}`;
    for (let split = 0; split <= source.length; split++) {
      const parser = new SSEDecoder();
      assert.deepEqual([...parser.push(source.slice(0, split)), ...parser.push(source.slice(split))], ["नमस्ते\nworld", "[DONE]"]);
    }
  });
}

test("only one ASCII space after data colon is removed", () => {
  const parser = new SSEDecoder();
  assert.deepEqual(parser.push("data:  indented\ndata:\ttab\ndata: nbsp\n\n"), [" indented\n\ttab\n nbsp"]);
});

test("empty data fields dispatch while comments and other fields do not", () => {
  const parser = new SSEDecoder();
  assert.deepEqual(parser.push(": comment\nevent: message\nid: 1\n\ndata\n\ndata:\n\n"), ["", ""]);
});

test("one initial BOM is ignored without stripping later content", () => {
  const parser = new SSEDecoder();
  assert.deepEqual(parser.push("\ufeffdata: first\n\ndata: \ufeffsecond\n\n"), ["first", "\ufeffsecond"]);
});

test("an oversized unfinished event is rejected instead of accumulating forever", () => {
  const parser = new SSEDecoder(32);
  parser.push("data: " + "x".repeat(20));
  assert.throws(() => parser.push("x".repeat(20)), /too large/i);
  assert.throws(() => parser.push("\n\n"));
});

test("many data lines in one event are bounded, but separate events reset the limit", () => {
  const parser = new SSEDecoder(32);
  for (let i = 0; i < 20; i++) assert.deepEqual(parser.push("data: hello\n\n"), ["hello"]);
  assert.throws(() => parser.push("data: hello\n".repeat(20)), /too large/i);
});


const encoder = new TextEncoder();
async function collect(body: ReadableStream<Uint8Array>) {
  const values: string[] = [];
  for await (const value of readSSE(body)) values.push(value);
  return values;
}

test("UTF-8 decoding survives every byte boundary and discards incomplete final events", async () => {
  const bytes = encoder.encode("\ufeffdata: नमस्ते 🌊\r\n\r\ndata: incomplete");
  for (let split = 0; split <= bytes.length; split++) {
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(bytes.slice(0, split)); controller.enqueue(bytes.slice(split)); controller.close(); },
    });
    assert.deepEqual(await collect(body), ["नमस्ते 🌊"]);
    assert.equal(body.locked, false);
  }
});

test("the byte decoder and framing parser strip only one BOM together", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(encoder.encode("\ufeff\ufeffdata: ignored\n\ndata: kept\n\n")); controller.close(); },
  });
  assert.deepEqual(await collect(body), ["kept"]);
});

test("a consumer can stop on DONE without waiting for the server to close", async () => {
  let cancelled = 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(encoder.encode("data: hello\n\ndata: [DONE]\n\ndata: ignored\n\n")); },
    cancel() { cancelled++; },
  });
  const seen: string[] = [];
  for await (const event of readSSE(body)) {
    if (event === "[DONE]") break;
    seen.push(event);
  }
  assert.deepEqual(seen, ["hello"]);
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
});

test("consumer parsing failure cancels the source and preserves the original error", async () => {
  let cancelled = 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(encoder.encode("data: not-json\n\n")); },
    cancel() { cancelled++; throw new Error("cleanup failed"); },
  });
  await assert.rejects(async () => {
    for await (const event of readSSE(body)) JSON.parse(event);
  }, SyntaxError);
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
});

test("valid events preceding an oversized event remain delivered and the body is cancelled", async () => {
  let cancelled = 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(encoder.encode("data: partial reply\n\ndata: " + "x".repeat(300_000))); },
    cancel() { cancelled++; },
  });
  const seen: string[] = [];
  await assert.rejects(async () => {
    for await (const event of readSSE(body)) seen.push(event);
  }, /too large/i);
  assert.deepEqual(seen, ["partial reply"]);
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
});

test("reader errors propagate and release the stream lock", async () => {
  const failure = new Error("upstream interrupted");
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(failure); } });
  await assert.rejects(collect(body), (error) => error === failure);
  assert.equal(body.locked, false);
});
