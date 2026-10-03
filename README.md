# Svara Campaign Studio — Sites deployment

Local businesses can discuss an offer by voice or chat, generate a poster, and draft a custom promotional website. English and Hindi voice requests can populate editable creative drafts. Website generation supports preview, HTML download, promotional copy and optional publication after generation.

Chat, images and voice use CallMissed. Custom website generation uses OpenAI directly; this expanded version does not meet the internship's CallMissed-only restriction. The original compliant version is preserved in the sibling svara-studio repository at callmissed-only-v1.

## Hosting

Vinext on Cloudflare Workers through Sites. D1 stores atomic spending reservations, login attempts and website ownership/publication metadata. R2 stores generated HTML documents. Runtime keys are Sites secrets, absent from source and client bundles.

The hosted CallMissed allowance is $5. The existing local app retains its $14 allowance; combined allocations are $19, leaving $1 of the internship budget unallocated. Reservations remain consumed after failures and must not be reset. OpenAI has a separate allowance and defaults to zero until the user specifies a total limit. Each website reserves 10 cents before its bounded request. Provider billing may differ from reservations.

New Sites are private to their owner. A generated website's publish action makes it available within the Site's existing audience; it does not bypass Sites access restrictions. Chat history and drafts remain device-local. Website ownership currently follows the reviewer cookie, which expires after one day; permanent accounts and recovery are not implemented.

## Development

Use npm install, npm run dev, npm run db:generate for schema changes, and the Sites build workflow for publishing. Database migrations are in drizzle/. Do not edit already-applied migrations. Store local development credentials only in ignored environment files.

No automatic paid requests are made on page load. Live microphone playback was reported successful by the user on the original local app. Hosted microphone behavior still requires a user test.

## Verification

`npm test` runs the actual hosted storage adapters in an isolated Cloudflare Worker emulator. It verifies concurrent budget reservations, duplicate suppression, separate provider allowances, burst limiting, login throttling, voice ownership, and R2-backed private/published/unpublished pages. It makes no paid API requests. The local Next.js implementation has 14 additional route, stream, sanitizer and voice-intent tests in the main branch.

The production database schema was inspected after deployment and includes all three expected tables. At that inspection its operations table was empty. The local hosted-runtime preview passed reviewer login and mobile editor checks. Live OpenAI generation remains unverified until its spending allowance is supplied.
