# Deployment preparation

No infrastructure has been provisioned or deployed. The local runtime uses Node 24 and SQLite. Before Vercel/Render/Atlas deployment, replace local persistence with an approved new production database adapter, implement production auth and data protections, configure a new HTTPS origin and provider sandbox integrations, and verify the operational gates in docs/SECURITY.md.

Do not deploy SQLite on an ephemeral or horizontally scaled filesystem. Do not use Vercel serverless functions as persistent SQLite storage. No production deploy command is intentionally wired to an automatic branch push.
