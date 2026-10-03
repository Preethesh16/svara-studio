# Verification record — 3 October 2026

## Automated, mocked where stated

`npm test`: **9 passed**.

- SSE parsing across split chunks, including Hindi and DONE.
- SQLite reservations persist across close/reopen; duplicates and overspend are refused.
- Burst limits persist in the ledger.
- Signed cookies reject tampering.
- Eight concurrent processes, $0.45 allowance, $0.15 each: exactly three succeed; total stays $0.45.
- Anonymous, oversized and cross-origin requests never reach the mocked provider.
- Mocked image success, duplicate suppression, ambiguous provider failure and exhausted-budget rejection.
- Mocked chat streaming, abort-signal propagation and server model/output limits.
- Mocked voice session minting enforces Sarvam speech and 60 seconds; only the owning reviewer session can terminate it.

`npm run typecheck`: passed. `npm run build`: passed before final documentation; final production build repeated after changes. `npm audit --omit=dev`: zero known vulnerabilities at test time. Native SQLite initially had a Node ABI mismatch; rebuilt for the project runtime and reran tests successfully.

## Real CallMissed checks

| Check | Observed result |
|---|---|
| Authenticated model catalog | HTTP 200 |
| Account usage and balance | Read-only success; shared account, not key-specific |
| Sarvam chat, 650 output tokens | SSE completed but no visible answer; replaced for text chat |
| Gemma 4 26B chat in browser | English/Hindi reply streamed and completed |
| Flux 2 Klein smoke | Inline image returned |
| GPT Image 2 in browser | Café poster rendered; download link exposed |
| Voice create | Session JWT and CallMissed media URL returned |
| Voice DELETE | Successful cleanup response |

All paid checks were sent through the app's reservation boundary. Five paid operations have reserved **$1.10**, leaving **$12.90** of the $14 application allowance. This is NOT the exact provider charge. No recurring service was purchased.

## Browser checks

- Reviewer login passes. An initial localhost origin comparison mismatch was fixed to compare Origin host with request Host.
- Café chat and approved image generation work in the local UI.
- Chat, prompt and image survive a page reload.
- Desktop three-panel layout inspected.
- Mobile conversation/canvas tabs inspected; observed viewport and document widths match (no horizontal overflow).
- Mobile access-card overflow corrected.
- Screenshots in the deliverables folder show actual application output.

## Outstanding verification — do not claim these passed

- Real microphone permission denial, microphone capture and audible agent responses.
- English/Hindi speech recognition, interruptions, mute/unmute, audio autoplay recovery and disconnect cleanup on actual hardware.
- Full keyboard/accessibility audit and screen reader use.
- Browser cancellation under a live slow response (abort propagation is covered by a mock).
- Actual provider charge reconciliation by key. Subsequent provider requests carry X-Session-Id=svara-studio for attribution.
- Docker runtime and deployed HTTPS behavior, durable storage across deployment, production voice and mobile audio.

No test auto-starts a microphone or image operation on page load. Browser image testing was an explicit one-time integration check; the reusable automated suite uses mocks and cannot consume credits.
