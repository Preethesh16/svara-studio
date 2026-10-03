# Budget controls

The assignment allowance is $20 total. The user confirmed the key was unused on 3 October 2026. Account balance and usage data were shared tenant totals, so do not treat them as this key's allowance.

Planning: up to $3 integration, $4 development, $8 reviewer use, $5 reserve. We use fewer calls. App cap is $14 in conservative reservations; the extra $1 below the planned $15 spending cap adds headroom. The cap includes tests made through the app.

SQLite stores an append-only reservation BEFORE each paid operation. BEGIN IMMEDIATE serializes simultaneous reservations, including across processes sharing the file. Duplicate request IDs cannot reserve again. A crash, failed request, timeout or cancellation retains the full reservation. We deliberately do not release uncertain charges. Reservations are not actual provider bills.

| Operation   | Reservation | Limit                                         |
| ----------- | ----------: | --------------------------------------------- |
| Chat        |       $0.05 | 12,000 context characters + 650 output tokens |
| GPT Image 2 |       $0.35 | One 1024×1024 image, catalog estimate $0.2604 |
| Voice       |       $0.50 | 60 seconds, explicit Sarvam stack             |

The first Flux smoke test reserved $0.15 under the earlier model selection. Sarvam chat test reserved $0.05 even though it returned no visible text. No refunds are credited back to the ledger.

Voice reserves conservatively but is NOT a mathematically guaranteed provider charge ceiling: fallback stacks and post-call analysis may alter cost. There is no exposed per-session dollar cap. The provider duration limit, fixed stack, generous reservation and safety margin reduce this risk. Confirm the issuer's $20 key cap in the console; do not raise it.

For deployment, copy the existing SQLite ledger using SQLite backup while quiescent, preserving all test reservations. Mount it on persistent storage. Never run isolated ledger copies across replicas, reset the volume, or redeploy with an empty ledger. Back up the database before migration. Single-host deployment is intentional. Other applications using this key would bypass this ledger; do not share it with other projects.

Durable rate control limits paid operations to six per minute globally. Authentication is server-enforced. Changing request IDs, clearing browser storage or restarting the process does not reset spending history. Pause live mode with LIVE_ENABLED=false if charges diverge from estimates.
