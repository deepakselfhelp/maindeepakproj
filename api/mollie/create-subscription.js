export default async function handler(req, res) {
  try {
    const { email, subscriptionId, adminPassword } = req.body;

    const ADMIN_PASS = process.env.ADMIN_PASSWORD;
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;

    if (adminPassword !== ADMIN_PASS) {
      return res.status(403).json({ error: "Invalid admin password" });
    }

    if (!email || !subscriptionId) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 1️⃣ Get subscription details
    const subRes = await fetch(
      `https://api.mollie.com/v2/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${MOLLIE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const sub = await subRes.json();

    if (!sub.id) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const customerId = sub.customerId;

    // 2️⃣ Cancel subscription
    const cancelRes = await fetch(
      `https://api.mollie.com/v2/customers/${customerId}/subscriptions/${subscriptionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${MOLLIE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // If Mollie accepts cancellation: success
    if (cancelRes.status === 204) {
      return res.status(200).json({
        message: "Subscription cancellation request accepted",
      });
    }

    // Error fallback
    const errJson = await cancelRes.json();
    console.log("❌ Mollie Cancel Error:", errJson);

    return res.status(400).json({
      error: "Cancellation failed",
      details: errJson,
    });

  } catch (err) {
    console.error("❌ Cancel Subscription API Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
