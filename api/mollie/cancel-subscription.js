// ✅ /api/mollie/cancel-subscription.js (Password Protected)
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // 🔧 ALWAYS define environment variables at the top
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const ADMIN_PASSWORD = process.env.ADMIN_CANCEL_PASSWORD;

    // Now extract request body
    const { customerId, subscriptionId, password } = req.body;

    // 🔒 Password validation
    if (!password || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: "Invalid admin password" });
    }

    if (!customerId || !subscriptionId) {
      return res.status(400).json({
        success: false,
        error: "Missing customerId or subscriptionId",
      });
    }

    // 🔥 Cancel subscription via Mollie
    const cancelRes = await fetch(
      `https://api.mollie.com/v2/customers/${customerId}/subscriptions/${subscriptionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${MOLLIE_KEY}`,
        },
      }
    );

    if (cancelRes.status === 204) {
      return res.status(200).json({
        success: true,
        message: "Subscription cancelled successfully",
      });
    }

    // Get error details
    let errorDetails = {};
    try {
      errorDetails = await cancelRes.json();
    } catch (_) {}

    console.log("❌ Mollie Cancel Error:", errorDetails);

    return res.status(400).json({
      success: false,
      error: "Failed to cancel subscription",
      details: errorDetails,
    });

  } catch (err) {
    console.error("❌ Cancel Subscription API Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
