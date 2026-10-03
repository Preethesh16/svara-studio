import test from "node:test";
import assert from "node:assert/strict";
import { restoreSessions } from "../lib/sessions";

const session = (id = "one") => ({
  id, title: "Café launch", messages: [{ role: "user", content: "नमस्ते 🌊", source: "voice" }],
  prompt: "A poster", created: 1234,
});
const restore = (value: unknown) => restoreSessions(JSON.stringify(value));

test("missing and invalid storage always restore to an array", () => {
  for (const raw of [null, "", "{", "null", "false", "3", '"text"', "{}", "[null]"])
    assert.deepEqual(restoreSessions(raw), []);
});
test("bad entries do not discard the remaining saved conversations", () => {
  assert.deepEqual(restore([null, session(), {}, false, session("two")]), [session(), session("two")]);
});
test("valid history and optional creative results survive unchanged", () => {
  const saved = { ...session(), image: "data:image/png;base64,AA==", imageModel: "test", imagePrompt: "poster", websiteBrief: "café",
    website: { id: "site", title: "Café", document: "<html></html>", caption: "hello", whatsapp: "welcome", model: "test", usage: 0, publicPath: "/sites/site" } };
  assert.deepEqual(restore([saved]), [saved]);
});
test("malformed messages cannot reach the markdown renderer", () => {
  const saved = session();
  const result = restore([{ ...saved, messages: [null, false, {}, { role: "assistant", content: {} }, { role: "system", content: "x" }, ...saved.messages, { role: "assistant", content: "", source: {} }] }]);
  assert.deepEqual(result[0].messages, [...saved.messages, { role: "assistant", content: "" }]);
});
test("invalid optional values are omitted and scalar defaults are safe", () => {
  const [saved] = restore([{ ...session(), title: {}, prompt: null, created: "yesterday", image: {}, imageModel: false, imagePrompt: [], websiteBrief: 42, website: { title: {} } }]);
  assert.equal(saved.title, "Untitled session");
  assert.equal(saved.prompt, "");
  assert.equal(saved.created, 0);
  for (const key of ["image", "imageModel", "imagePrompt", "websiteBrief", "website"]) assert.equal(key in saved, false);
});
test("session identifiers and message arrays are required", () => {
  for (const invalid of [{ id: {} }, { id: 42 }, { id: "" }, { messages: {} }, { messages: null }])
    assert.deepEqual(restore([{ ...session(), ...invalid }]), []);
});
test("duplicate identifiers preserve the first session and history stays at twelve", () => {
  const saved = Array.from({ length: 20 }, (_, i) => session(String(i)));
  assert.deepEqual(restore([saved[0], { ...saved[0], title: "duplicate" }, ...saved.slice(1)]), saved.slice(0, 12));
});

test("malformed website metadata does not discard an otherwise usable conversation", () => {
  const website = { id: "\ud800", title: "Café", document: "<html></html>", caption: "hello", whatsapp: "welcome", model: "test", usage: -1, publicPath: "javascript:alert(1)" };
  const [saved] = restore([{ ...session(), website }]);
  assert.deepEqual(saved.messages, session().messages);
  assert.equal(saved.website?.document, website.document);
  assert.equal(saved.website?.usage, undefined);
  assert.equal(saved.website?.publicPath, undefined);
});
