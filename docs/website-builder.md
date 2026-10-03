# Custom business websites

This is an expanded product feature requested after the original CallMissed take-home was built. It calls OpenAI directly and therefore does not satisfy the issuer's CallMissed-only condition. The original source remains available at `callmissed-only-v1`.

## Flow

1. A spoken image or website command is recognized locally from final user transcript segments. English and Hindi phrase matching populates editable drafts. It never calls a paid API by itself; duplicate final segments are ignored.
2. Describe the business in Website studio. Choose whether to include the existing CallMissed poster. OpenAI receives the text brief, not the poster bytes.
3. The server reserves $0.10 in a separate SQLite ledger, then calls the OpenAI Responses API using `gpt-4.1-mini-2025-04-14`, a 6,000 output-token ceiling, structured JSON output and `store:false`. Responses include custom HTML/CSS and promotional copy. There are no automatic retries.
4. HTML is sanitized, CSS remote-resource rules are removed, and a restrictive Content Security Policy is added. The iframe runs without script or same-origin permissions. Generated pages do not execute model-generated JavaScript.
5. The complete document is stored privately on the app host and returned for preview and download. Publishing changes its visibility; a random page URL is served by this app. The optional automatic-publish checkbox authorizes that step before generation. Unpublish reverses visibility. Publishing requires the reviewer session that generated the document.

## Scope

Custom responsive single-page websites with static content, contact links, CSS motion and optional embedded artwork. No arbitrary applications, checkout, databases, signup flows, working forms, social posting, custom domains or separate hosting provisioning. Unknown business facts are not to be fabricated; users must review model output.

The shared server database stores generated documents (which may include business contact details and image data); the browser stores brief/result copies. Clearing browser history does not delete server documents. Published pages remain available until unpublished. Reviewer sessions expire after one day; persistent multi-user ownership and account recovery are not implemented in this demonstration.

A localhost publication is local only. Public HTTPS URLs require deploying this app to an eligible host with persistent storage. Preserve both `usage.sqlite` and `usage.sqlite.openai` across deployments. The original ledger also holds published page documents.

## Configuration and costs

Set `OPENAI_API_KEY` only on the server. Set `OPENAI_LIMIT_CENTS` to the user's chosen total allowance. A zero or missing allowance disables live generation. It is independent of CallMissed's $20 budget. Reservations remain charged to the local allowance on uncertain failures and cancellations; they are not actual bills.

Verified official pricing for this model is $0.40/million input and $1.60/million output tokens. A ten-cent reservation is conservative for the fixed brief and output limits. Key/model availability was verified with a read-only request; a live website request still requires the separate allowance.

Sources: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-4.1 mini model and pricing](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

## Tests

The added mocked tests cover injected scripts/iframes/event handlers, remote resource removal, permitted embedded images, English/Hindi intent and negation handling, missing-key refusal before any request, owner-only publication/unpublication, private pages returning not-found, duplicate requests and separate budget exhaustion. No real key is used in automated tests.
