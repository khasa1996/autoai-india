# Security boundaries and production gaps

## Verified local controls

Consult tests and the current validation report for evidence, rather than treating this checklist as a certification. The API uses server-side sessions, hashed passwords, parameterized SQL, validation and explicit role/tenant checks. User input cannot make an account an administrator. Payment collection and private-document upload are unavailable until configured.

## Before external exposure

- Run behind HTTPS with explicit trusted application origin; never expose the development API directly.
- Add verified email, password reset, MFA for privileged accounts, distributed login throttling, session management and trusted proxy configuration.
- Establish documented lawful basis, consent, retention, deletion, authorized processors and Indian privacy/consumer/payment review. Do not claim legal compliance from code alone.
- Keep identity documents outside public assets; implement short-lived signed authorization, malware scanning, encryption with managed keys and audited access before accepting files.
- Establish migration, encrypted backup and tested restore procedures. Local SQLite contains personal data and session hashes; keep `.data` out of Git and limit file permissions.
- Cryptographically validate gateway signatures on raw request bytes, verify amount/currency/recipient/order mapping, reject replay, persist idempotency and reconcile settlement. A successful browser redirect is not payment evidence.
- Authenticate all operational milestones and dealer stock updates. Audit privileged changes. Make audit storage immutable in a production service.
- Rate-limit and sandbox asset processing. Local GLB inspection is not malware certification. Enforce resource and texture limits before processing untrusted files on a server.
- Never reuse old AutoAI India credentials. Supply fresh development/sandbox bindings only after a provider is selected.

Report suspected vulnerabilities privately to the future project security owner; no address is invented here.
