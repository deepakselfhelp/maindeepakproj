// ✅ Razorpay Webhook + Brevo Email (Inbox-Safe Plain Text)

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

    // 🗂️ Map internal Razorpay plan IDs to user-friendly names
    const PLAN_NAME_MAP = {
      "plan_RcO3xG88LCkMNo": "Hindi Pro Community 699",
      "plan_RfBy2sLVRdY2VN": "Deepak Academy Monthly",
      "plan_Example123": "Dating Mastery Premium",
      // add more as needed
    };

    // Escape MarkdownV2 special characters (Telegram)
    function escapeMarkdownV2(text) {
      return text.replace(/([_*\[\]()~`>#+\\=\-|{}.!\\])/g, "\\$1");
    }

    // ✅ Telegram message sender
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

    // ✅ Brevo email sender (plain text)
    async function sendBrevoEmail(to, subject, text) {
      try {
        const apiKey = process.env.BREVO_API_KEY;
        const senderEmail = "support@realcoachdeepak.com";

        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify({
            sender: { name: "Deepak Team", email: senderEmail },
            to: [{ email: to }],
            subject,
            htmlContent: text.replace(/\n/g, "<br>"),
          }),
        });

        const data = await res.json();
        console.log("📧 Brevo email response:", data);
      } catch (err) {
        console.error("❌ Brevo email error:", err);
      }
    }

    // Helpers to extract customer info
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
      const name = payment.notes?.name || "Customer";
      const planId =
        payment.notes?.plan_id ||
        payment.notes?.plan_name ||
        payment.notes?.subscription_name ||
        null;

      const readablePlanName =
        PLAN_NAME_MAP[planId] ||
        payment.notes?.product ||
        "Subscription (via Razorpay Button)";

      const tgMessage = escapeMarkdownV2(`
🏦 *Source:* Razorpay
💰 *New Payment Captured*
📦 *Product:* ${readablePlanName}
📧 *Email:* ${email}
💵 *Amount:* ${currency} ${amount}
🆔 *Payment ID:* ${payment.id}
`);
      await sendTelegramMessage(tgMessage);

      const emailBody = `
🏦 Source: Razorpay
💰 New Payment Captured
📦 Product: ${readablePlanName}
📧 Email: ${email}
💵 Amount: ${currency} ${amount}
🆔 Payment ID: ${payment.id}

If you purchased a subscription, you'll receive access details shortly.
If you didn't authorize this payment, please contact us immediately.

Warm regards,  
Deepak Team  
support@realcoachdeepak.com
`;
      await sendBrevoEmail(email, `Payment Confirmation – ${readablePlanName}`, emailBody);
      console.log(`✅ [Payment Captured] ${payment.id}`);
    }

    // 🔁 2️⃣ Subscription Renewal Charged
    if (event === "subscription.charged" && subscription) {
      const planId = subscription.plan_id;
      const readablePlanName = PLAN_NAME_MAP[planId] || planId;

      const subId = subscription.id;
      const totalCount = subscription.total_count || "∞";
      const email = extractEmail(subscription);
      const phone = extractPhone(subscription);

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
🔁 *Subscription Renewal Charged*
📦 *Product:* ${readablePlanName}
📧 *Email:* ${email}
📱 *Phone:* ${phone}
🧾 *Subscription ID:* ${subId}
💳 *Cycle Count:* ${totalCount}
`);
      await sendTelegramMessage(message);
      console.log(`🔁 [Renewal] ${subId}`);

      const emailBody = `
🏦 Source: Razorpay
🔁 Subscription Renewal Charged
📦 Product: ${readablePlanName}
📧 Email: ${email}
📱 Phone: ${phone}
🧾 Subscription ID: ${subId}
💳 Cycle Count: ${totalCount}

Thank you for staying with us!

Warm regards,  
Deepak Team  
support@realcoachdeepak.com
`;
      await sendBrevoEmail(email, `Subscription Renewal – ${readablePlanName}`, emailBody);
    }

    // ⚠️ 3️⃣ Payment Failed
    if (event === "payment.failed" && payment) {
      const amount = (payment.amount / 100).toFixed(2);
      const currency = payment.currency || "INR";
      const failReason = payment.error_description || "Unknown reason";
      const email = extractEmail(payment);
      const phone = extractPhone(payment);

      const planId =
        payment.notes?.plan_id ||
        payment.notes?.plan_name ||
        payment.notes?.subscription_name ||
        null;
      const readablePlanName =
        PLAN_NAME_MAP[planId] ||
        payment.notes?.product ||
        "Razorpay Payment";

      const tgMessage = escapeMarkdownV2(`
🏦 *Source:* Razorpay
⚠️ *Payment Failed*
📦 *Product:* ${readablePlanName}
📧 *Email:* ${email}
📱 *Phone:* ${phone}
💵 *Amount:* ${currency} ${amount}
❌ *Reason:* ${failReason}
🆔 *Payment ID:* ${payment.id}
`);
      await sendTelegramMessage(tgMessage);
      console.log(`⚠️ [Payment Failed] ${payment.id}`);

      const emailBody = `
🏦 Source: Razorpay
⚠️ Payment Failed
📦 Product: ${readablePlanName}
📧 Email: ${email}
📱 Phone: ${phone}
💵 Amount: ${currency} ${amount}
❌ Reason: ${failReason}
🆔 Payment ID: ${payment.id}

Please try again or contact us for help if you believe this is an error.

Warm regards,  
Deepak Team  
support@realcoachdeepak.com
`;
      await sendBrevoEmail(email, `Payment Failed – ${readablePlanName}`, emailBody);
    }

    // 🚫 4️⃣ Subscription Cancelled / Rebill Failed
    if (event === "subscription.cancelled" && subscription) {
      const planId = subscription.plan_id;
      const readablePlanName =
        PLAN_NAME_MAP[planId] ||
        subscription.notes?.product ||
        "Razorpay Plan";

      const subId = subscription.id;
      const reason =
        subscription.cancel_reason ||
        "Cancelled manually or after failed rebills";
      const failedRebill =
        reason.includes("multiple failed rebill") ||
        reason.includes("failed payment");
      const email = extractEmail(subscription);
      const phone = extractPhone(subscription);

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
${failedRebill ? "🚨 *Subscription Failed After Multiple Rebill Attempts!*" : "🚫 *Subscription Cancelled*"}
📦 *Product:* ${readablePlanName}
📧 *Email:* ${email}
📱 *Phone:* ${phone}
🧾 *Subscription ID:* ${subId}
❌ *Reason:* ${reason}
`);
      await sendTelegramMessage(message);
      console.log(`🚫 [Cancelled] ${subId}`);

      const emailBody = `
🏦 Source: Razorpay
${failedRebill ? "🚨 Subscription Failed After Multiple Rebill Attempts!" : "🚫 Subscription Cancelled"}
📦 Product: ${readablePlanName}
📧 Email: ${email}
📱 Phone: ${phone}
🧾 Subscription ID: ${subId}
❌ Reason: ${reason}

If this was not intended, you can resubscribe anytime at https://realcoachdeepak.com.

Best regards,  
Deepak Team  
support@realcoachdeepak.com
`;

      const subjectLine = failedRebill
        ? `Subscription Failed (Rebill Attempts) – ${readablePlanName}`
        : `Subscription Cancelled – ${readablePlanName}`;

      await sendBrevoEmail(email, subjectLine, emailBody);
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ [Webhook Error]:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
}
