# Payments — disabled integration, tested signature primitive

`webhook.ts` validates Razorpay-style raw-body HMAC-SHA256 signatures and binds a captured event to expected merchant, order and amount. Synthetic fixtures test local cryptography; no provider sandbox request has been executed. This is not a working payment gateway integration.

The API checkout route remains unavailable. Before enabling it: select an approved direct-dealer or platform-settlement arrangement, establish fresh sandbox credentials, create provider orders server-side, persist expected recipient/order/amount, atomically deduplicate provider event IDs with booking transitions, reconcile settlements, implement refund accounting and test actual signed sandbox webhooks. Do not trust browser success callbacks. No real payment is authorized.
