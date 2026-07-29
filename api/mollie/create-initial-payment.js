// Legacy checkout retired.
// Existing subscription webhooks continue through /api/mollie/webhook.

export default async function handler(req, res) {
  return res.status(410).json({
    error: "This checkout has been retired. Please use https://pay.deepakandteam.com.",
  });
}
