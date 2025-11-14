// ✅ Razorpay Webhook + Brevo Email (Async + Duplicate Safe)

const processedRazorpayEvents = new Set();
setInterval(() => processedRazorpayEvents.clear(), 120000); // clear every 2 min

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = req.body;
    const event = body.event;
    const payment = body.payload?.payment?.entity;
    const subscription = body.payload?.subscription?.entity;

    // 🚫 Duplicate protection
    const paymentId = payment?.id || subscription?.id || "unknown";
    const eventKey = `${event}-${paymentId}`;

    if (processedRazorpayEvents.has(eventKey)) {
      console.log(`⚠️ Duplicate Razorpay event ignored: ${eventKey}`);
      return res.status(200).send("Duplicate ignored");
    }
    processedRazorpayEvents.add(eventKey);

    // ⚡ Immediate acknowledgment (prevents Razorpay retries)
    res.status(200).send("OK");

    // Continue processing asynchronously
    setTimeout(() => handleRazorpayEvent(body), 0);

    // Stop execution (we already responded to Razorpay)
    return;
  } catch (err) {
    console.error("❌ [Webhook Error]:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
}

// ✅ MAIN EVENT HANDLER LOGIC
async function handleRazorpayEvent(body) {
  try {
    const event = body.event;
    const payment = body.payload?.payment?.entity;
    const subscription = body.payload?.subscription?.entity;

    console.log(`📬 Received Razorpay Event: ${event}`);

    // 🗂️ Plan Name Map
    const PLAN_NAME_MAP = {
      "plan_RcO3xG88LCkMNo": "Hindi Pro Community 699",
      "plan_RfBy2sLVRdY2VN": "Dating Infields Domination",
      "plan_Example123": "Dating Mastery Premium",
    };

    // 🗂️ Button Map (one-time payments)
    const BUTTON_ID_MAP = {
      "pl_RfCnu3mYnC3FrA": "Deepak Infield Domination Monthly",
      "pl_RcOmJ9ipDaPrjg": "Hindi Pro Community 699",
      "pl_RxExample001": "Dating Mastery Premium",
    };

    // 🔠 Markdown Escaper
    function escapeMarkdownV2(text) {
      return text.replace(/([_*\[\]()~`>#+\\=\-|{}.!\\])/g, "\\$1");
    }

    // ✅ Telegram Sender
    async function sendTelegramMessage(text) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!botToken || !chatId) return;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "MarkdownV2",
        }),
      });
    }

    // ✅ Brevo Email Sender (with admin copy)
    async function sendBrevoEmail(to, subject, text) {
      try {
        const apiKey = process.env.BREVO_API_KEY;
        const senderEmail = "support@realcoachdeepak.com";
        const adminEmail = "deepakdating101@gmail.com";

        const recipients = [{ email: to }];
        if (to !== adminEmail) recipients.push({ email: adminEmail });

        const htmlContent = `
${text.replace(/\n/g, "<br>")}
<hr style="margin-top:20px;border:0;border-top:1px solid #ccc;">
<p style="font-size:13px;color:#555;">Admin copy for record — Sent to: ${to}</p>`;

        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify({
            sender: { name: "Deepak Team", email: senderEmail },
            to: recipients,
            subject,
            htmlContent,
          }),
        });
        console.log("📧 Brevo response:", await res.json());
      } catch (err) {
        console.error("❌ Brevo email error:", err);
      }
    }

    // Helper extractors
    const extractEmail = (obj) =>
      obj?.email ||
      obj?.customer_email ||
      obj?.customer_details?.email ||
      obj?.notes?.email ||
      obj?.contact_email ||
      "N/A";

    const extractPhone = (obj) =>
      obj?.contact ||
      obj?.customer_contact ||
      obj?.customer_details?.contact ||
      obj?.notes?.phone ||
      "N/A";

    // === EVENT HANDLERS ===

    // 💰 Payment Captured
    if (event === "payment.captured" && payment) {
      const amount = (payment.amount / 100).toFixed(2);
      const email = extractEmail(payment);
      const planId =
        payment.notes?.plan_id ||
        payment.notes?.plan_name ||
        payment.subscription_id ||
        null;
      const readablePlanName =
        PLAN_NAME_MAP[planId] ||
        payment.description ||
        payment.notes?.product ||
        "Deepak Course Purchase";

      const tgMsg = escapeMarkdownV2(`
🏦 *Source:* Razorpay
💰 *New Payment Captured*
📦 *Product:* ${readablePlanName}
📧 *Email:* ${email}
💵 *Amount:* INR ${amount}
🆔 *Payment ID:* ${payment.id}`);

      await sendTelegramMessage(tgMsg);

      const emailBody = `
🏦 Source: Razorpay
💰 New Payment Captured
📦 Product: ${readablePlanName}
📧 Email: ${email}
💵 Amount: INR ${amount}
🆔 Payment ID: ${payment.id}

If you purchased a subscription, you'll receive access details shortly.

Warm regards,
Deepak Team
support@realcoachdeepak.com`;
      await sendBrevoEmail(email, `Payment Confirmation – ${readablePlanName}`, emailBody);
      console.log(`✅ [Payment Captured] ${payment.id}`);
    }

    // ✅ Subscription Activated
    if (event === "subscription.activated" && subscription) {
      const planId = subscription.plan_id;
      const readablePlanName = PLAN_NAME_MAP[planId] || planId;
      const email = extractEmail(subscription);
      const phone = extractPhone(subscription);
      const subId = subscription.id;

      const tgMsg = escapeMarkdownV2(`
🏦 *Source:* Razorpay
✅ *Subscription Activated*
📦 *Product:* ${readablePlanName}
📧 *Email:* ${email}
📱 *Phone:* ${phone}
🧾 *Subscription ID:* ${subId}`);
      await sendTelegramMessage(tgMsg);

      const emailBody = `
🏦 Source: Razorpay
✅ Subscription Activated
📦 Product: ${readablePlanName}
📧 Email: ${email}
📱 Phone: ${phone}
🧾 Subscription ID: ${subId}

Welcome to ${readablePlanName}!
Your first payment has been received and your subscription is now active.

Warm regards,
Deepak Team
support@realcoachdeepak.com`;
      await sendBrevoEmail(email, `Subscription Activated – ${readablePlanName}`, emailBody);
    }

    // 🔁 Subscription Renewal
    if (event === "subscription.charged" && subscription) {
      const planId = subscription.plan_id;
      const readablePlanName = PLAN_NAME_MAP[planId] || planId;
      const email = extractEmail(subscription);
      const phone = extractPhone(subscription);
      const subId = subscription.id;

      const msg = escapeMarkdownV2(`
🏦 *Source:* Razorpay
🔁 *Subscription Renewal Charged*
📦 *Product:* ${readablePlanName}
📧 *Email:* ${email}
📱 *Phone:* ${phone}
🧾 *Subscription ID:* ${subId}`);

      await sendTelegramMessage(msg);

      const emailBody = `
🏦 Source: Razorpay
🔁 Subscription Renewal Charged
📦 Product: ${readablePlanName}
📧 Email: ${email}
📱 Phone: ${phone}
🧾 Subscription ID: ${subId}

Thank you for staying with us!

Warm regards,
Deepak Team
support@realcoachdeepak.com`;
      await sendBrevoEmail(email, `Subscription Renewal – ${readablePlanName}`, emailBody);
    }

    // 🚫 Cancelled or Failed Rebill
    if (event === "subscription.cancelled" && subscription) {
      const planId = subscription.plan_id;
      const readablePlanName = PLAN_NAME_MAP[planId] || "Razorpay Plan";
      const email = extractEmail(subscription);
      const phone = extractPhone(subscription);
      const subId = subscription.id;
      const reason =
        subscription.cancel_reason ||
        "Cancelled manually or after failed rebills";

      const msg = escapeMarkdownV2(`
🏦 *Source:* Razorpay
🚫 *Subscription Cancelled*
📦 *Product:* ${readablePlanName}
📧 *Email:* ${email}
📱 *Phone:* ${phone}
🧾 *Subscription ID:* ${subId}
❌ *Reason:* ${reason}`);

      await sendTelegramMessage(msg);

      const emailBody = `
🏦 Source: Razorpay
🚫 Subscription Cancelled
📦 Product: ${readablePlanName}
📧 Email: ${email}
📱 Phone: ${phone}
🧾 Subscription ID: ${subId}
❌ Reason: ${reason}

If this was not intended, you can resubscribe anytime at https://realcoachdeepak.com.

Warm regards,
Deepak Team
support@realcoachdeepak.com`;
      await sendBrevoEmail(email, `Subscription Cancelled – ${readablePlanName}`, emailBody);
    }

  } catch (err) {
    console.error("❌ Razorpay Event Handler Error:", err);
  }
}
