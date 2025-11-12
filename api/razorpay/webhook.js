// ✅ Final Razorpay Webhook + Email Receipts via Sender.net (non-breaking version)

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

    const SENDER_API_KEY = process.env.SENDER_API_KEY;
    const SUPPORT_EMAIL = "support@realcoachdeepak.com";

    // ---------- Helper Functions ---------- //

  function escapeMarkdownV2(text) {
  return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

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

    // ✅ Send Email via Sender.net
    async function sendEmailWithSender(to, subject, htmlContent) {
      if (!SENDER_API_KEY || !to || to === "N/A") return;
      try {
        const res = await fetch("https://api.sender.net/v2/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SENDER_API_KEY}`,
          },
          body: JSON.stringify({
            from: { email: SUPPORT_EMAIL, name: "RealCoachDeepak" },
            to: [{ email: to }],
            subject,
            html: htmlContent,
          }),
        });
        console.log(`📧 Email sent to ${to} (${subject})`);
      } catch (err) {
        console.error("❌ Email sending failed:", err);
      }
    }

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

    const now = new Date().toLocaleString("en-GB", {
      timeZone: "Europe/Berlin",
      hour12: false,
    });

    // ---------- EVENT 1️⃣ Payment Captured ---------- //
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

      // ✅ Email Receipt
      const subject = `✅ Payment Receipt — ${product}`;
      const html = `
        <div style="background:#0a0a0a;color:#fff;font-family:Poppins,Arial,sans-serif;padding:30px;">
          <div style="max-width:600px;margin:auto;border:1px solid #f5b800;border-radius:12px;padding:25px;">
            <h2 style="color:#f5b800;">Payment Successful!</h2>
            <p>Dear customer,</p>
            <p>We’ve received your payment for <strong>${product}</strong>.</p>
            <p><strong>Amount:</strong> ${currency} ${amount}</p>
            <p><strong>Date:</strong> ${now}</p>
            <p>Your subscription is now active. You can cancel anytime by emailing 
            <a href="mailto:${SUPPORT_EMAIL}" style="color:#f5b800;">${SUPPORT_EMAIL}</a>.</p>
            <hr/>
            <p style="font-size:13px;color:#aaa;">© ${new Date().getFullYear()} RealCoachDeepak</p>
          </div>
        </div>`;
      await sendEmailWithSender(email, subject, html);
    }

    // ---------- EVENT 2️⃣ Subscription Renewal Charged ---------- //
    if (event === "subscription.charged" && subscription) {
      const planName =
        subscription.notes?.product ||
        subscription.plan_id ||
        "Razorpay Subscription Plan";
      const subId = subscription.id;
      const email = extractEmail(subscription);

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
🔁 *Subscription Renewal Charged*
📦 *Product:* ${planName}
📧 *Email:* ${email}
🧾 *Subscription ID:* ${subId}
`);
      await sendTelegramMessage(message);
      console.log(`🔁 [Renewal] ${subId}`);

      // ✅ Renewal Email
      const subject = `🔁 Subscription Renewal — ${planName}`;
      const html = `
        <div style="background:#0a0a0a;color:#fff;font-family:Poppins,Arial,sans-serif;padding:30px;">
          <div style="max-width:600px;margin:auto;border:1px solid #f5b800;border-radius:12px;padding:25px;">
            <h2 style="color:#f5b800;">Subscription Renewed</h2>
            <p>Your ${planName} subscription has been renewed successfully.</p>
            <p><strong>Date:</strong> ${now}</p>
            <p>Thank you for staying with us!</p>
          </div>
        </div>`;
      await sendEmailWithSender(email, subject, html);
    }

    // ---------- EVENT 3️⃣ Payment Failed ---------- //
    if (event === "payment.failed" && payment) {
      const amount = (payment.amount / 100).toFixed(2);
      const currency = payment.currency || "INR";
      const failReason = payment.error_description || "Unknown reason";
      const email = extractEmail(payment);

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
⚠️ *Payment Failed*
📧 *Email:* ${email}
💵 *Amount:* ${currency} ${amount}
❌ *Reason:* ${failReason}
🆔 *Payment ID:* ${payment.id}
`);
      await sendTelegramMessage(message);
      console.log(`⚠️ [Payment Failed] ${payment.id}`);

      // ✅ Failed Email
      const subject = `⚠️ Payment Failed — Attempt Notice`;
      const html = `
        <div style="background:#0a0a0a;color:#fff;font-family:Poppins,Arial,sans-serif;padding:30px;">
          <div style="max-width:600px;margin:auto;border:1px solid #f5b800;border-radius:12px;padding:25px;">
            <h2 style="color:#e74c3c;">Payment Failed</h2>
            <p>Your latest payment was unsuccessful.</p>
            <p><strong>Reason:</strong> ${failReason}</p>
            <p><strong>Attempted On:</strong> ${now}</p>
            <p>We will retry automatically, no action needed yet.</p>
          </div>
        </div>`;
      await sendEmailWithSender(email, subject, html);
    }

    // ---------- EVENT 4️⃣ Subscription Cancelled ---------- //
    if (event === "subscription.cancelled" && subscription) {
      const planName =
        subscription.notes?.product ||
        subscription.plan_id ||
        "Razorpay Plan";
      const subId = subscription.id;
      const reason =
        subscription.cancel_reason ||
        "Cancelled manually or after failed rebills";
      const failedRebill =
        reason.includes("multiple failed rebill") ||
        reason.includes("failed payment");
      const email = extractEmail(subscription);

      const message = escapeMarkdownV2(`
🏦 *Source:* Razorpay
${failedRebill ? "🚨 *Subscription Failed After Multiple Rebill Attempts!*" : "🚫 *Subscription Cancelled*"}
📦 *Product:* ${planName}
📧 *Email:* ${email}
🧾 *Subscription ID:* ${subId}
❌ *Reason:* ${reason}
`);
      await sendTelegramMessage(message);
      console.log(`🚫 [Cancelled] ${subId}`);

      // ✅ Cancelled Email
      const subject = `🚫 Subscription Cancelled — ${planName}`;
      const html = `
        <div style="background:#0a0a0a;color:#fff;font-family:Poppins,Arial,sans-serif;padding:30px;">
          <div style="max-width:600px;margin:auto;border:1px solid #f5b800;border-radius:12px;padding:25px;">
            <h2 style="color:#e74c3c;">Subscription Cancelled</h2>
            <p>Your subscription for <strong>${planName}</strong> has been cancelled.</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>You can resubscribe anytime from the Academy website.</p>
          </div>
        </div>`;
      await sendEmailWithSender(email, subject, html);
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ [Webhook Error]:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
}
