# Campaign Studio implementation plan

## Provider split, explicitly requested by the user
CallMissed continues to provide chat, images and voice. Direct OpenAI provides custom business website generation. This expanded product is outside the internship's CallMissed-only constraint. Git tag `callmissed-only-v1` preserves the original submission version.

## Milestones
1. Add a server-only OpenAI Responses adapter with structured output, separate spending reservations, timeout and no automatic retries.
2. Generate sanitized custom HTML/CSS; isolate previews, export a standalone page, store generated pages and publish/unpublish through the app.
3. Route spoken image/website requests into editable drafts without silently spending credits. Deduplicate transcript events.
4. Add a campaign workspace with website builder, copy-ready promotional text, animated state transitions and reduced-motion support.
5. Test unsafe generated markup, spending isolation, missing-key behavior, publication ownership, voice intent routing and responsive UI.
6. Build, scan for secrets, document limitations, update GitHub and keep a local preview running.
7. Connect the user's OpenAI key and explicit separate allowance for a minimal live test. Deploy once free hosting access is available.

Automation covers generation, assembly, preview, export and serving published pages. The user initiates paid generations and publishing within the app. No social messages are sent and no paid hosting is provisioned.
