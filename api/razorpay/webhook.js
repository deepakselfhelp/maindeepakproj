// ✅ Final Razorpay Webhook (shows Email + Phone in all Telegram messages)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = req.body;
    const event = body.event;
    const payment = body.payload?.payment?.entity;
    const subscription = body.payload?.subscription?.entity;

    console.log(`📬 Received Razorpay Event: ${event}`);

    // Escape MarkdownV2 special characters
    function escapeMarkdownV2(text) {
      return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
    }

    // Send Telegram message
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

    // Helper to extract email and phone (works for all events)
    function extractEmail(obj) {
      return (
        obj?.email ||
        obj?.customer_email ||
        obj?.customer_details?.email ||
        obj?.notes?.email ||
        obj?.contact_email ||
        obj?.customer_notify_email ||
        "N/A"
      );
    }

    function extractPhone(obj) {
      return (
        obj?.contact ||
        obj?.customer_contact ||
        obj?.customer_details?.contact ||
        obj?.notes?.phone ||
        obj?.phone ||
        "N/A"
      );
    }

    // 💰 1️⃣ Payment Captured
    if (event === "payment.captured" && payment) {
      const amount = (payment.amount / 100).toFixed(2);
      const currency = payment.currency || "INR";
      const email = extractEmail(payment);
      const phone = extractPhone(payment);
      const product =
        payment.notes?.product ||
        payment.notes?.plan_name ||
        payment.notes?.subscription_name ||
        "Subscription (via Razorpay Button)";

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
💰 *New Payment Captured*
📦 *Product:* ${product}
📧 *Email:* ${email}
📱 *Phone:* ${phone}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${payment.id}
`);
      await sendTelegramMessage(message);
      console.log(`✅ [Payment Captured] ${payment.id}`);
    }

    // 🔁 2️⃣ Subscription Renewal Charged
    if (event === "subscription.charged" && subscription) {
      const planName =
        subscription.notes?.product ||
        subscription.plan_id ||
        "Razorpay Subscription Plan";
      const subId = subscription.id;
      const totalCount = subscription.total_count || "∞";
      const email = extractEmail(subscription);
      const phone = extractPhone(subscription);

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
🔁 *Subscription Renewal Charged*
📦 *Product:* ${planName}
📧 *Email:* ${email}
📱 *Phone:* ${phone}
🧾 *Subscription ID:* ${subId}
💳 *Cycle Count:* ${totalCount}
`);
      await sendTelegramMessage(message);
      console.log(`🔁 [Renewal] ${subId}`);
    }

    // ⚠️ 3️⃣ Payment Failed
    if (event === "payment.failed" && payment) {
      const amount = (payment.amount / 100).toFixed(2);
      const currency = payment.currency || "INR";
      const failReason = payment.error_description || "Unknown reason";
      const email = extractEmail(payment);
      const phone = extractPhone(payment);

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
⚠️ *Payment Failed*
📧 *Email:* ${email}
📱 *Phone:* ${phone}
💵 *Amount:* ${currency} ${amount}
❌ *Reason:* ${failReason}
🆔 *Payment ID:* ${payment.id}
`);
      await sendTelegramMessage(message);
      console.log(`⚠️ [Payment Failed] ${payment.id}`);
    }

    // 🚫 4️⃣ Subscription Cancelled / Rebill Failed
    if (event === "subscription.cancelled" && subscription) {
      const planName =
        subscription.notes?.product ||
        subscription.plan_id ||
        "Razorpay Plan";
      const subId = subscription.id;
      const reason = subscription.cancel_reason || "Cancelled manually or after failed rebills";
      const failedRebill =
        reason.includes("multiple failed rebill") || reason.includes("failed payment");
      const email = extractEmail(subscription);
      const phone = extractPhone(subscription);

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
${failedRebill ? "🚨 *Subscription Failed After Multiple Rebill Attempts!*" : "🚫 *Subscription Cancelled*"}
📦 *Product:* ${planName}
📧 *Email:* ${email}
📱 *Phone:* ${phone}
🧾 *Subscription ID:* ${subId}
❌ *Reason:* ${reason}
`);
      await sendTelegramMessage(message);
      console.log(`🚫 [Cancelled] ${subId}`);
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ [Webhook Error]:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
}
