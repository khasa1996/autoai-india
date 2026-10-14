# AutoAI India — greenfield architecture

This independent project lives in `/workspace/autoai-india` in the connected `khasa1996/autoai-india` repository. It has no dependency on earlier AutoAI India repositories, accounts, databases or deployment resources. No production environment has been created.

## Runtime boundaries

The customer website uses Next.js and React. A same-origin `/api` proxy forwards requests to a Fastify API listening only on the loopback interface. Shared TypeScript packages provide automotive validation, deterministic recommendation scoring, finance mathematics, configuration rules and a translation registry. Three.js owns the canvas and GLB scene lifecycle; it must never manufacture an accurate vehicle from absent assets.

The local API uses SQLite WAL storage via Node 24's built-in SQLite module. This is a durable, zero-credential development adapter, not the requested eventual MongoDB Atlas deployment. Move storage behind repositories and implement a MongoDB adapter with transaction and migration tests before a hosted multi-instance deployment. A database engine name in a roadmap does not establish support.

Authentication uses salted scrypt password hashes and random, hashed server-side session tokens. Customer registration never accepts a role. Administrative access is an explicit local bootstrap operation. Dealer membership and stock are scoped to authorized businesses. Session cookies are HttpOnly and SameSite; production additionally requires Secure and the __Host prefix. The edge must provide HTTPS. Production authentication still needs email verification, account recovery, MFA, abuse controls, and independent review.

## Truth boundaries

The initial catalogue is empty. Only reviewed, source-attributed records may be published. No consumer-facing demo stock, prices, bookings, reviews or delivery events are seeded. Tests use conspicuously synthetic fixtures in isolated temporary databases.

Recommendation ranking is deterministic, with disclosed reasons and missing-data exclusions. It is not a hosted generative AI model. Loan and ownership calculations show user-supplied assumptions. A booking request is not a dealer acceptance, payment receipt, or confirmed delivery commitment.

Payments and private documents fail closed until approved provider and storage adapters exist. Domain transition rules do not authenticate payment events by themselves. Provider-specific cryptographic verification, durable event deduplication, reconciliation and refund accounting must precede enabling collection. Remaining vehicle payments go directly to the authorized dealer.

## Asset pipeline

Production vehicle geometry, media and configuration compatibility require licensed sources and human review. GLB inspection and local loading are separate from approval of a vehicle's engineering accuracy. A generated concept image is illustrative and cannot serve as evidence of a production model or variant. STEP output requires valid CAD geometry; polygonal GLB cannot be represented as genuine CAD by renaming its file extension.

## Delivery model

Keep one deployable API while boundaries stabilize, rather than creating ten untested network services. Introduce isolated workers when ingestion, notifications and asset processing have real jobs and measurable retry requirements. Implement an outbox before claiming reliable cross-service delivery. Mobile, dealer, admin and studio clients should reuse domain contracts and authorization enforced by the API, never browser-only role checks.
