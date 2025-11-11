// ✅ /api/mollie/create-subscription.js
export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Missing name or email" });
    }

    // 1️⃣ Create customer
    const customerRes = await fetch("https://api.mollie.com/v2/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email }),
    });

    const customer = await customerRes.json();
    if (!customer.id) {
      console.error("❌ Mollie customer error:", customer);
      return res.status(400).json({ error: "Customer creation failed" });
    }

    // 2️⃣ Create initial payment (to confirm mandate)
    const paymentRes = await fetch("https://api.mollie.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: { value: "29.00", currency: "EUR" },
        description: "Deepak Academy Monthly Membership",
        redirectUrl: "https://checkout.realcoachdeepak.com/success.html",
        webhookUrl: "https://checkout.realcoachdeepak.com/api/mollie/webhook",
        customerId: customer.id,
        sequenceType: "first", // marks it as first payment for mandate
        metadata: { name, email, planType: "DID Main Subscription" },
      }),
    });

    const payment = await paymentRes.json();

    if (!payment?._links?.checkout?.href) {
      console.error("❌ Mollie payment error:", payment);
      return res.status(400).json({ error: "Payment creation failed" });
    }

    // 3️⃣ Return checkout URL to frontend
    res.status(200).json({ checkoutUrl: payment._links.checkout.href });
  } catch (err) {
    console.error("❌ create-subscription error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
