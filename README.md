# AutoAI India — independent greenfield foundation

A new TypeScript monorepo in the connected `khasa1996/autoai-india` repository. It does not use previous AutoAI India application code, databases, deployments or credentials.

**Current delivery:** a responsive customer website, Expo mobile shell, local dealer/admin workspaces, browser-based licensed-GLB studio, working local API, and shared domain/3D libraries. Production partner integrations and signed device builds are not complete; see [feature status](docs/FEATURE_STATUS.md).

## Run locally

Requirements: Node.js 24, npm, and Chromium for WebGL tests. No cloud account or external credentials are needed for this local workflow.

```sh
cd /workspace/autoai-india
npm ci
npm run build
npm start
npm run start:web
```

The API listens on loopback port 4000 and the website on port 3000. `npm run dev` runs both with source watching. `GET /api/health` reports persistence and integration status; `GET /api/catalogue` initially returns an empty list. This is intentional: no invented public catalogue or stock is seeded.

```sh
npm run typecheck
npm test
npm run test:smoke
npm run test:assets-browser
npm run test:web-browser
npm run build:mobile
npm run test:mobile-browser
```

The smoke test starts an isolated API, creates synthetic data in a temporary database, checks persistence across a restart, and deletes the test database. The WebGL test uses clearly synthetic geometry; it proves renderer behavior, not production vehicle accuracy. Set `CHROMIUM_EXECUTABLE_PATH` if Chromium is not at `/usr/bin/chromium`.

## Local data and authentication

SQLite data defaults to `.data/autoai.sqlite`, excluded from Git. `DATABASE_PATH`, `API_PORT`, and `APP_ORIGIN` are supported non-secret settings. Customer accounts can register through the API. A local admin can be created using `services/api/src/create-admin.ts` with fresh `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` supplied securely in the process environment; never place the password in commands, committed files or chat. No administrator is preseeded.

See [API contracts](services/api/README.md) for required bodies, roles, origin validation and booking idempotency. A booking request only reserves verified fresh stock; it does not collect money or assert delivery. Payment checkout and private-document uploads return unavailable.

## Structure

- `services/api`: durable local API, authentication and authorization.
- `packages/automotive-domain`, `validation`: evidence-backed catalogue, finance, ranking, inventory and booking rules.
- `packages/api-client`, `i18n`, `design-tokens`: shared client contracts, 23-language registry and design tokens.
- `packages/configurator`, `three-engine`, `services/asset-pipeline`: local licensed-GLB validation and genuine 3D interaction.
- `services/payments`: tested signature-verification primitive, with gateway integration disabled.
- `tests`: domain, API, cryptographic and real-browser checks.
- `docs`, `infrastructure`: scope, architecture, security, operational guidance and deployment prerequisites.

[Product brief](docs/PRODUCT_BRIEF.md) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [Security](docs/SECURITY.md) · [Runbook](docs/RUNBOOK.md)

AutoAI India is an independent automotive platform. Showcase images and configurator assets are original, AI-generated or used under documented permission and remain unbranded. Third-party vehicle designs and media remain their owners' property; a disclaimer does not grant asset rights. No compliance, nationwide coverage, live AI service or production readiness is claimed.
