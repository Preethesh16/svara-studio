# Deployment preparation

Deploy one Node 22 container on an existing or verified free-tier host with persistent disk and HTTPS. Do not assume an AWS account still has free EC2 eligibility. Current credentials deny ec2:DescribeInstances and freetier:GetAccountPlanState, so no AWS resources were provisioned.

1. Verify host eligibility, disk, bandwidth and public IPv4 charges before provisioning. Do not enable paid services.
2. Copy source, create a private `.env.local` with random reviewer code and session secret, and set the API key server-side. Do not bake environment files into images.
3. Preserve the development ledger in `data/usage.sqlite`, using SQLite backup before migration. Keep only one live deployment using the key. Restrict file permissions; container uid 1000 must be able to write the data directory.
4. Run `docker compose up --build -d`. The app binds to loopback on the host; a TLS reverse proxy should forward to port 3000 and preserve Host, disable response buffering for SSE, and allow 90-second requests. Use an existing domain and free TLS certificate. Forwarded cookies must use HTTPS.
5. Check unauthenticated requests are refused, reviewer login succeeds, SSE streams, one image succeeds, microphone permissions work, spoken audio plays, mute/end work, and the ledger survives restart. Test on mobile.
6. Publish the verified HTTPS URL only after those checks. Keep the access code private and send it separately in the submission email.

Dockerfile and compose.yaml are prepared, but container deployment has not been verified on a host. Free hosts with ephemeral disks are unsuitable for this SQLite design. A durable platform database could be substituted, but that requires a reviewed implementation change.
