# Local API

Node 24 is required for `node:sqlite`. From the workspace root run `npm run dev:api`. API listens on `127.0.0.1:4000`; the Next app proxies `/api/*` to it. Set `DATABASE_PATH` to change the durable database path (default `.data/autoai.sqlite` in this workspace). Keep SQLite files private and back them up; this single-process implementation is not a distributed production datastore.

No catalogue, dealer, inventory, booking, review, or valuation data is preloaded. Administrator ingestion requires provenance URLs and verification timestamps. Operators remain responsible for verifying rights, accuracy, freshness and dealer authorization before ingestion.

Create the initial administrator explicitly with `npx tsx services/api/src/create-admin.ts`, supplying `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` through securely injected environment variables. Password minimum is 16 characters for this command. There is no default administrator and registration always creates a customer. Do not save passwords in shell history or repository files.

## Contracts

All routes are prefixed `/api`. Auth uses an opaque, hashed-at-rest, 24-hour session in an HTTP-only SameSite=Lax cookie. In production the cookie requires HTTPS and uses the `__Host-` prefix. `APP_ORIGIN` must equal the frontend origin; development default is `http://localhost:3000`. Production startup refuses an absent explicit origin. Requests with `Sec-Fetch-Site: cross-site` are also rejected. Mutation requests with a different Origin are rejected. No cross-origin browser access is enabled; use the frontend's same-origin proxy.

- `POST /auth/register`: `{name,email,password}` (minimum 12 characters).
- `POST /auth/login`: `{email,password}`. Both return `{user:{id,name,email,role}}` and a session cookie.
- `GET /auth/me`, `POST /auth/logout`.
- `GET /catalogue?query=&fuel=&bodyType=`: `{vehicles:[{id,make,model,variant,fuel,bodyType,pricePaise,sourceUrl,verifiedAt,specifications}]}`. Up to 100 results.
- `GET /catalogue/:id`: `{vehicle,offers}`. Offers currently use database snake_case fields; only stock with an unexpired offer is returned.
- `POST /comparisons`: `{vehicleIds:[uuid,uuid]}` (2–4 unique catalogue IDs).
- `GET /garage`: `{configurations}`; `POST /garage`: `{vehicleId,notes?}`; `DELETE /garage/:id`.
- `GET /bookings`: `{bookings}`; `POST /bookings`: `{offerId}` with required `Idempotency-Key` header (8–128 alphanumeric, underscore or hyphen). Repeated user/key/offer returns the existing booking; a key reused for a different offer returns 409. Offers must have verified stock within the last 24 hours and belong to an admin-accepted dealer. Booking is an unpaid request and atomically reserves one stock unit. `PATCH /bookings/:id`: `{status:'confirmed'|'cancelled'}`. Customers can cancel their own pending/confirmed requests; the scoped dealer or admin can confirm. Completion is intentionally unavailable until verified fulfillment milestones are implemented. Cancellation restores stock exactly once.
- `GET /support`: `{tickets}`; `POST /support`: `{subject,message}` (message minimum 10 characters).
- `GET /exchange`: `{requests}`; `POST /exchange`: `{registrationYear,make,model,kilometres}`. No automated valuation is issued.
- `POST /payments/checkout`, `POST /documents/upload`: authenticated `503 INTEGRATION_UNAVAILABLE`. No provider or private storage is configured. Neither accepts funds or files.
- `POST /admin/catalogue`: `{make,model,variant,fuel,bodyType,pricePaise,sourceUrl,verifiedAt,specifications?}`. Fuel: petrol/diesel/electric/hybrid/cng.
- `POST /admin/dealers`: `{name,sourceUrl,verifiedAt}` (records the accepting admin); `POST /admin/memberships`: `{userId,dealerId}`. Admin only.
- `POST /offers`: `{vehicleId,dealerId,pricePaise,stock,sourceUrl,verifiedAt,expiresAt}`. Admin or dealer with that membership only. Timestamps must be ISO datetimes; expiry must be future, verification cannot be future or more than 24 hours old. All provenance URLs require HTTPS.

`GET /dealer/dashboard` returns scoped `{dealers,offers,bookings}` for dealer members. `GET /admin/audit` returns the latest 200 `{events}`; `GET /admin/dealers` returns `{dealers}`. Admin read routes reject dealer/customer users.

All monetary values are integer INR paise. UUIDs identify records. Validation errors return 400; missing authentication 401; permissions 403; missing records 404; state/stock conflicts 409. Request bodies are limited to 32 KiB and per-IP request limits are applied. Audit records cover catalogue, offers, dealer membership and booking mutations.

## Scope and production requirements

This is a local development foundation. Payment collection/webhooks/refunds, protected document storage, verified catalogue import, email verification, password recovery, MFA, distributed abuse prevention, full privacy retention/export/deletion policies, finance/insurance adapters and legal/compliance workflows require additional implementation before production. Do not enter real personal documents or financial data. No SMS, email, lender, insurer or dealer notification is sent by these endpoints.

Run `npm test -- tests/api/app.test.ts`. Tests create isolated temporary SQLite files and fixture-only catalogue records; fixture data is never added to the application's database.

## Deterministic advisor and finance APIs

`POST /api/advisor` accepts only `{customerNeeds:{budgetInr,minimumSeats,preferredFuel?,preferredTransmission?,preferredBodyStyle?,requiredFeatures?}}`. It reads the durable catalogue itself; caller-supplied vehicle lists are rejected. Results contain `recommendations`, `excludedCount`, `exclusions`, `freshnessPolicy`, `mode: "deterministic"` and a disclaimer. No generative provider is configured. Ranking only considers records with reviewed seats/transmission, features and compatibleOptionIds JSON-string arrays, sourceType, retrievedAt, and verifiedBy. The verifier identity is overwritten with the authenticated administrator's ID on ingestion. Missing or invalid facts and verification older than 90 days are explicitly excluded rather than inferred. Preferences cannot override budget, seating and required-feature constraints.

`POST /api/finance/emi` accepts `{principalInr,annualRatePercent,months}` and returns `monthlyInr`, `totalInr`, `interestInr`, and a disclaimer. Rates are 0–100%; terms are 1–600 whole months. Zero-interest scenarios use principal divided by term.

`POST /api/finance/ownership` requires `{purchaseInr,registrationInr,annualInsuranceInr,annualMaintenanceInr,annualKm,energyCostPerKmInr,years,resaleInr,financeInterestInr?}` and returns `totalInr`, `monthlyInr`, `runningInr`, preserved `assumptions` and a disclaimer. Years are 1–30; all monetary inputs must be finite and nonnegative; resale cannot exceed purchase price. All finance amounts use INR (not paise). These public calculation endpoints do not submit lender applications or produce binding offers.

New database directories are created with mode 0700 and new database files with mode 0600. Existing files and directory permissions are left unchanged. SQLite indexes cover user-owned records, dealer memberships, offer stock query paths, catalogue filters and audit chronology. Leading-substring catalogue search still scans matching records; replace with a search index before scaling the catalogue.
