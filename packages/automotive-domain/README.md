# Automotive domain

Pure TypeScript functions shared by trusted server handlers and presentation layers. There is no bundled vehicle catalogue; test fixtures are synthetic and never runtime seeds.

- `recommendVehicles` validates provenance records, enforces ex-showroom budget, seat and required-feature constraints, and scores fuel/transmission/body-style preferences. Scores are deterministic, explainable fit indicators, not safety ratings. Ex-showroom budgets exclude on-road charges.
- `validateConfiguration` checks variant compatibility, option requirements, exclusions and duplicate selections. Option rules must come from a reviewed source before being presented as manufacturer claims.
- `matchInventory` requires verified, available, recently checked stock, matching configuration/city, and availability by the requested deadline. It does not reserve stock or guarantee delivery. The server must atomically reserve inventory.
- `estimateEmi` uses the monthly reducing-balance formula. `estimateOwnership` preserves user-supplied assumptions. Neither output is a finance offer, binding quote or tax calculation.
- `transitionBooking` enforces role and state constraints, event replay suppression, payment identity, booking identity, currency and integer paise amount. Paid cancellations enter `refund-pending`; a late payment after cancellation also requires a refund. Full refunds only are supported in this first release.

## Security boundary

`PaymentEvidence.verified` is an internal server assertion, **never a customer-supplied field**. Before calling the transition function, the API must verify the provider webhook signature against the original request bytes, validate provider event type and status, load the booking and expected amount from its database, and map authenticated provider evidence to this internal structure. Authenticate roles server-side. Persist transitions and processed event identifiers in one database transaction with a unique provider event constraint; an in-memory object cannot enforce distributed idempotency.

Schema provenance is a structural gate, not proof that a URL or reviewer is authentic. Restrict ingestion and review to authenticated authorized staff; preserve immutable audit records and only query approved catalogue rows for public recommendations. Production freshness requirements differ by data field and must be configured at ingestion.

## Freshness policy

Recommendation eligibility defaults to verification within the last 90 days; callers can supply an explicit `CatalogueFreshnessPolicy` with a stricter `maxAgeDays` and a deterministic evaluation date. Records outside the window, from the future, or using non-HTTPS sources are excluded. This is a conservative application policy, not a claim about manufacturer update schedules. Inventory has its own default 24-hour check window. Ingestion should reverify prices and availability more frequently where needed.
