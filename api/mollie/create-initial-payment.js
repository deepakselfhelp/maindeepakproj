// ✅ /api/mollie/create-initial-payment.js
// Always creates a new customer + payment + mandate per checkout
export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const { name, email, initialAmount, recurringAmount, planType } = req.body;

    if (!name || !email || !initialAmount) {
      console.error("❌ Missing fields:", { name, email, initialAmount });
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1️⃣ Always create a *new* Mollie customer
    const newCustRes = await fetch("https://api.mollie.com/v2/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email }),
    });
    const customer = await newCustRes.json();

    if (!customer?.id) {
      console.error("❌ Customer creation failed:", customer);
      return res.status(400).json({ error: "Customer creation failed" });
    }

    console.log(`✅ New Mollie customer created: ${customer.id}`);

    // 2️⃣ Create the initial payment (new mandate every time)
    const payRes = await fetch("https://api.mollie.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: { value: initialAmount, currency: "EUR" },
        description: `${planType || "Deepak Academy"} Initial Payment`,
        redirectUrl: "https://checkout.realcoachdeepak.com/success.html",
        webhookUrl: "https://checkout.realcoachdeepak.com/api/mollie/webhook",
        customerId: customer.id,
        sequenceType: "first", // 💥 always new mandate
        metadata: {
          name,
          email,
          planType,
          recurringAmount,
          type: "initialPayment",
        },
      }),
    });

    const payment = await payRes.json();

    if (payRes.status !== 201 || !payment._links?.checkout?.href) {
      console.error("❌ Mollie Payment Error:", payment);
      return res.status(400).json({
        error: "Failed to create payment",
        details: payment,
      });
    }

    console.log(`✅ Mollie Payment Created: ${payment.id}`);
    res.status(200).json({
      checkoutUrl: payment._links.checkout.href,
      customerId: customer.id,
      paymentId: payment.id,
    });
  } catch (err) {
    console.error("❌ create-initial-payment error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
