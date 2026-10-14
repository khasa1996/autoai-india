# Feature status and acceptance evidence

Validated on 2026-10-15 in the current cloud machine. This is an early working foundation, not completion of all nine phases.

| Area                    | Implemented and verified                                                                                                       | Still required                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Foundation              | Fresh local repository, TypeScript workspaces, Node24 setup, API build, CI configuration                                       | New GitHub remote, approved hosted infrastructure, production database adapter                                 |
| Identity                | Scrypt passwords, hashed sessions, customer registration, admin bootstrap, role and tenant checks                              | Email verification, recovery, MFA, production abuse controls                                                   |
| Catalogue               | Source-attributed admin ingestion, query/detail endpoints, typed rich domain schema, freshness checks                          | Complete verified India catalogue, source licensing, ingestion workers/editorial review UI                     |
| Discovery/design        | Approved responsive Next.js homepage, navigation, catalogue search, and source-attributed vehicle detail page                  | Editorial publishing and complete production catalogue                                                         |
| Advisor/comparison      | Deterministic ranking, strict exclusions, stored-data advisor and accessible comparison interfaces                             | Generative AI provider, full conversational experience and evaluation                                          |
| Finance                 | EMI and ownership domain functions and HTTP endpoints with assumptions                                                         | Finance/insurance partner quotes, verified city tax data                                                       |
| Dealer/inventory        | Reviewed dealer records, memberships, tenant-scoped offers/dashboard API and role-gated local interface                        | National partner integrations, feasibility/logistics engine                                                    |
| Booking                 | Durable stock reservation, persistent retry idempotency, scoped confirmation/cancellation, audit                               | Complete fulfilment workflow, verified operational milestones, refunds and reconciliation                      |
| Garage/support/exchange | Authenticated APIs and responsive interfaces for saved vehicles, tickets, and exchange requests                                | AI support, human operations, inspection and valuation partners                                                |
| Payments                | Raw-body signature and amount/order/recipient validation primitive tested with synthetic events                                | Real sandbox integration and signed provider acceptance tests; checkout intentionally unavailable              |
| Documents               | Storage metadata schema and fail-closed upload endpoint                                                                        | Encrypted private storage, antivirus scanning, consent/retention/access workflows                              |
| 3D                      | Browser showroom for local licensed GLB loading, orbit, camera presets, paint, articulation, state restoration and SHA binding | Licensed vehicle assets and model accuracy review, authored interiors/animations, environments/LOD/compression |
| Asset studio            | Local studio UI, manifest and structural validators, and truthful export capability metadata                                   | Generation provider, conversion workers and approval workflow                                                  |
| Languages               | English + 22 scheduled-language registry; English/Hindi small dictionary and fallback review metadata                          | Complete reviewed translations, multilingual search/support and native-script UI QA                            |
| Mobile                  | Expo SDK 57 shell for Android, iOS and web with discovery, catalogue, advisor boundary, finance and account boundary           | Secure native authentication, full feature parity, device builds/signing and physical-device QA                |
| Operations              | Local startup/runbook, test CI, security and deployment prerequisites                                                          | Hosted monitoring, backups/restore automation, threat assessment, compliance review                            |

## Executed evidence

- Frozen installation (`npm ci`) passed.
- `npm run typecheck` passed.
- `npm run build` passed; compiled API started successfully under Node 24.
- `npm test`: **48 tests passed across 5 files** (domain/client, API, GLB/configuration and payment signature checks).
- `npm run test:smoke`: real HTTP registration, authorization, support storage across restart, payment unavailability and logout passed in an isolated temporary database.
- `npm run test:assets-browser`: **11 real Chromium WebGL checks passed** with synthetic test geometry. No production car rendering claim is made.
- `npm run test:web-browser`: desktop/mobile layout, navigation, catalogue state, calculator, registration, authenticated support and route rendering passed in Chromium.
- `npm run build:mobile`: Expo web, Android and iOS JavaScript/Hermes bundles generated successfully.
- `npm run test:mobile-browser`: exported mobile web shell, navigation and local EMI calculation passed in Chromium.
- Running development API: health and empty catalogue requests succeeded; zero-interest EMI returned exact expected arithmetic; advisor returned no fabricated recommendations from an empty catalogue.
- `npm audit --omit=dev --audit-level=high`: reported zero known vulnerabilities at the time checked. This is not a security audit or future guarantee.

## Not executed or not complete

No signed Android APK/AAB or iOS IPA/device build, real AI request, gateway sandbox transaction, production vehicle asset review, external database integration, deployment, production test or fresh-task restoration occurred. No paid infrastructure, real customer payments, previous project data or prior credentials were used. Expo Doctor completed 19/21 checks; the remaining config-schema and React Native Directory checks require blocked access to `exp.host`. Dependency alignment and Hermes checks passed with React Native 0.86.3.

The full audit, including development-only Expo/Metro tooling, reports 22 transitive advisories (15 high, 7 moderate). Current npm remediation proposes downgrading Expo to SDK 44, which is a breaking and unsupported change for this SDK 57 project. Runtime/production dependencies report zero advisories with `--omit=dev`; the development-tool advisories remain a tracked limitation pending compatible upstream releases.

Installation and startup instructions were saved to the cloud configuration draft. Draft persistence does not publish the environment or validate restoration. Review and save the settings, then publish through the product. Repository membership was not replaced: the project is connected to the new GitHub repository, and the previous checkout must not be used as its substitute.
