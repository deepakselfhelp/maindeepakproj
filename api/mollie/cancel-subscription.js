// ✅ /api/mollie/cancel-subscription.js (Password Protected)
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { customerId, subscriptionId, password } = req.body;
    console.log("Password received:", password);
console.log("Correct admin password:", ADMIN_PASSWORD);

    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const ADMIN_PASSWORD = process.env.ADMIN_CANCEL_PASSWORD; // 👈 Add this in Vercel

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

    // 🔥 Cancel subscription through Mollie
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
      // Success — webhook will fire automatically
      return res.status(200).json({
        success: true,
        message: "Subscription cancelled successfully",
      });
    }

    // Something went wrong → show error message
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
