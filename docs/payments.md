# Razorpay setup and payment operations

## Trust model

The server decides the service price, creates the provider order, and owns the booking record. The browser receives only the public Razorpay key ID, order ID, amount, and currency needed for Checkout. The API key secret and webhook signing secret must never appear in public JavaScript, logs, chat, Git, or a screenshot.

The checkout callback is a request to verify a payment. The server verifies its signature against the order already stored for that booking, then checks the canonical payment with Razorpay. A payment is confirmed only when its provider record has the expected order, amount, INR currency, and captured status. An authorised payment is pending until capture is verified. Webhook signatures use the original request bytes and a separate webhook secret.

Booking access tokens authorise a customer's status and verification requests. Treat them like private booking links. They are not proof of payment. Idempotency keys avoid creating another booking/order on an ordinary retry; use the same request and key when retrying after a lost response.

## Configure Razorpay

1. Complete Razorpay's merchant onboarding and confirm which payment methods are enabled for the account.
2. Start with a matched pair of test API credentials. Put values into the host's secret settings; use the variable names in `.env.example`.
3. Configure automatic capture in the merchant dashboard, or implement and operate a separate authorised-payment capture process. The website does not mark merely authorised funds as paid.
4. Create a webhook at `https://your-domain/api/webhooks/razorpay`. Enable `payment.captured`, `payment.authorized`, `order.paid`, `payment.refunded`, and `refund.processed`. Generate a distinct webhook secret and save the matching value securely as `RAZORPAY_WEBHOOK_SECRET`. The API key secret is a different value and purpose.
5. Run the scenarios below in test mode. Inspect both the application's administrator record and the Razorpay dashboard, including captured status, order, amount, and currency.
6. Switch to matched live credentials only after the business is ready, live payments are enabled by Razorpay, and the HTTPS live webhook is configured. Test keys and live keys are not interchangeable. Carry out a small real payment and refund, and reconcile it before sharing the checkout broadly.

Use a separate private `DATA_DIR` for live bookings. The server records the gateway mode in the database and refuses to reuse a test database for live payments (or vice versa). Archive test data privately; do not carry test appointments into the live calendar. Live keys are refused unless the server runs in production with an HTTPS `SITE_URL` and a configured administrator password hash.

Do not disable signature validation, accept an arbitrary client amount, or turn on a fake-payment mode to make checkout appear to work. Do not paste API secrets into the website. If a credential is exposed, rotate it at Razorpay and update the host's secret settings.

## Required acceptance scenarios

| Scenario | Expected business result |
| --- | --- |
| Correct captured payment | One confirmed booking for the expected service and price |
| Cancelled checkout or failed payment | No paid confirmation; reserved availability eventually releases |
| Authorised but uncaptured payment | Pending, without claiming that funds were captured |
| Browser closes immediately after payment | Signed webhook can reconcile the booking without the callback |
| Same callback or webhook received twice | Same booking result; no duplicate booking or confirmation |
| Forged signature, altered amount, unrelated payment/order | Rejected; booking is not marked paid |
| Network timeout while creating an order | Retry with the same idempotency key; do not ask the customer to pay blindly |
| Slot taken or changed while a late payment arrives | Manual review; do not promise two customers the same appointment |
| Application restart | Existing order, booking, and replay-protection records remain present |

Automated tests use a simulated provider to exercise these checks. They do not prove that Razorpay credentials, account capture settings, external delivery, refunds, or settlement work for the business.

## Pending payments and exceptions

If a customer says they paid but the site shows pending, do not ask them to pay again immediately. Check the Razorpay dashboard using the stored order/payment ID. Allow webhook delivery and retry the booking's verification. Verify that payment was captured and for the correct amount; an SMS, browser screenshot, or supplied payment ID alone is insufficient.

`manual_review` means staff must reconcile an exception such as a late payment after a reservation expired or an appointment conflict. Contact the customer and arrange another time or refund through the authenticated Razorpay dashboard. Do not represent a manual-review payment as a confirmed appointment. Keep an audit record of the decision.

Refunds and settlement reconciliation are operated in Razorpay's dashboard. The website does not provide an unaudited “mark paid” or refund shortcut. Publish realistic refund and cancellation terms approved by the business owner.

## Monitor and maintain

Check the protected inbox and Razorpay dashboard regularly. Investigate stale pending bookings, failed webhook deliveries, recurring verification failures, and disk usage. Configure provider webhook retries, keep test and live data separate, and use provider reports to reconcile deposits and refunds. Avoid logging payment credentials or full personal booking records while diagnosing errors.
