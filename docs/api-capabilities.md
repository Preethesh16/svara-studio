# CallMissed capabilities — verified 3 October 2026

## Authentication and account

Base URL: `https://api.callmissed.com`. Server sends a Bearer API key. No main credential reaches the client. Key permissions for voice must include llm, stt and tts; images require image. [Authentication](https://docs.callmissed.com/docs/authentication).

Read-only `/v1/models` authenticated successfully. The returned catalog includes Gemma 4 26B, Sarvam 105B, GPT Image 2, Flux 2 Klein, Saaras v3 and Bulbul v3. A listing alone is not proof of permission: the live tests below establish actual access for the operations tested. [Models](https://docs.callmissed.com/docs/models).

`/v1/usage/summary?days=90` returned tenant-wide usage, not an isolated internship allowance. Account MCP `get_credit_balance` returned a positive shared balance. Neither established this key's prior spend. The user confirmed this key was unused before testing. Shared account totals are intentionally excluded from this repository. [Usage](https://docs.callmissed.com/docs/usage-api), [account MCP](https://docs.callmissed.com/docs/agent-tools-mcp).

## Chat

`POST /v1/chat/completions`: model, messages `{role,content}`, stream:true, stream_options.include_usage:true, max_tokens:650, reasoning_effort:none. Responses are SSE `data:` JSON with choices[].delta.content; usage may be reported at the end; `[DONE]` terminates the stream. Context: at most 12 messages / 12,000 characters. [Chat](https://docs.callmissed.com/docs/chat-completion).

Observation: Sarvam 105B consumed 650 output tokens without visible text. Gemma `gemma-4-26b-a4b-it` with thinking disabled produced English and Hindi content in the app. No direct model-provider API is used.

## Images

`POST /v1/images/generations`: model:gpt-image-2, prompt, n:1, size:1024x1024, response_format:b64_json. Read data[0].b64_json; provider may also return a temporary signed URL. We display and save inline data, avoiding expiring URLs. Retain requested prompt and returned model if present; otherwise label the selected model. Editing/variations are not offered. [Images](https://docs.callmissed.com/docs/image-generation).

Observation: Flux 2 Klein returned an inline image; GPT Image 2 subsequently generated the café poster in the UI. The preferred GPT model is now selected. Catalog estimate: $0.2604 for a square GPT Image 2 image; actual charges must be reconciled with provider logs.

## Voice

`POST /v1/voice/sessions`: language en-IN/hi-IN, voice shubh, llm_model sarvam-105b, stt_model saaras:v3, tts_model bulbul:v3, tts_provider sarvam, max_duration_seconds:60, bounded system_prompt. Returns id, ws_url, token and config. Only connection fields and selected model reach the browser. LiveKit consumes the session-issued JWT and URL. Observed transport: `wss://livekit-prod.callmissed.com` (CallMissed-issued media infrastructure).

Events: TrackSubscribed attaches remote audio; TranscriptionReceived stores final segments; ActiveSpeakersChanged drives listening/responding; Reconnecting/Reconnected/Disconnected drive connection state. Mute changes the local microphone publication. Hangup stops tracks, disconnects, removes audio elements and calls `DELETE /v1/voice/sessions/{id}`. Pagehide sends the same authenticated cleanup; provider duration limit is the fallback.

`GET /v1/voice/sessions/{id}/transcript?format=json` exposes turns; `/cost` exposes actual models/credits, but these post-call endpoints are not yet integrated into the UI. Creation and DELETE passed; browser audio, Hindi recognition and interruptions remain unverified. The API may use a backup stack. [Voice sessions](https://docs.callmissed.com/docs/voice-sessions-api), [client library](https://docs.callmissed.com/docs/voice-sdk).

## Limits and errors

App maps 401, 402, 403, 429 and 503 to readable messages. No billable automatic retries. Sixty-second voice ceiling; six operations/minute globally; no user-controlled models. Estimates are distinct from actual charges. [Pricing](https://docs.callmissed.com/docs/credits-rate-limits), [limits](https://docs.callmissed.com/docs/rate-limits).
