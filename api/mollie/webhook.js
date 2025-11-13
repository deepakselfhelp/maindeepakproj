// ✅ /api/mollie/webhook.js — Final Stable Version (Extended with Open/Expired/Fail Fix)
const processedPayments = new Set();
// Auto-clear cache every 60 s
setInterval(() => processedPayments.clear(), 60000);

export default async function handler(req, res) {
  try {
    const MOLLIE_KEY = process.env.MOLLIE_SECRET_KEY;
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    const body = req.body;
    const paymentId = body.id || body.paymentId;

    // 🧠 Duplicate protection
    if (processedPayments.has(paymentId)) {
      console.log(`⚠️ Duplicate webhook ignored for ${paymentId}`);
      return res.status(200).send("Duplicate ignored");
    }
    processedPayments.add(paymentId);

    console.log("📬 Mollie webhook received:", paymentId);

    // 🕒 CET time
    const now = new Date();
    const timeCET = now.toLocaleString("en-GB", {
      timeZone: "Europe/Berlin",
      hour12: false,
    });

    // ✅ Fetch payment details
    const paymentRes = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MOLLIE_KEY}` },
    });
    const payment = await paymentRes.json();
    // add this block ⬇️
    const failReason =
    payment.details?.failureReason ||
    payment.failureReason ||
    payment.statusReason ||
    null;

  if (failReason && (payment.status === "open" || payment.status === "failed")) {
  await sendTelegram(
    `⚠️ *PAYMENT FAILED (EARLY DETECTED)*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n🏦 *Source:* Mollie\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n📦 *Plan:* ${planType}\n💬 *Reason:* ${failReason}\n💵 *Amount:* ${currency} ${amount}\n🆔 *Payment ID:* ${payment.id}`
  );
}

    if (!payment || !payment.id) {
      console.error("❌ Invalid payment payload:", payment);
      return res.status(400).send("Bad request");
    }

    const email = payment.metadata?.email || payment.customerEmail || "N/A";
    const name = payment.metadata?.name || "Unknown";
    const amount = payment.amount?.value || "0.00";
    const currency = payment.amount?.currency || "EUR";
    const customerId = payment.customerId;
    const sequence = payment.sequenceType || "unknown";
    const status = payment.status;
    const planType = payment.metadata?.planType || "DID Main Subscription";
    const recurringAmount = payment.metadata?.recurringAmount || "0.00";
    const isRecurring = parseFloat(recurringAmount) > 0;

    // 📨 Telegram helper
    async function sendTelegram(text) {
      if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: "Markdown",
          }),
        });
      } catch (err) {
        console.error("⚠️ Telegram send failed:", err);
      }
    }
	
	    // ✅ Brevo sender (plain text with admin copy)
    async function sendBrevoEmail(to, subject, text) {
      try {
        const apiKey = process.env.BREVO_API_KEY;
        const senderEmail = "support@realcoachdeepak.com";
        const adminEmail = "deepakdating101@gmail.com"; // 👈 Admin copy address

        // 1️⃣ Recipients list (avoid loops)
        const recipients = [{ email: to }];
        if (to !== adminEmail) recipients.push({ email: adminEmail });

        // 2️⃣ Admin footer for traceability
        const htmlContent = `
${text.replace(/\n/g, "<br>")}
<hr style="margin-top:20px;border:0;border-top:1px solid #ccc;">
<p style="font-size:13px;color:#555;">
Admin copy for record — Sent to: ${to}
</p>`;

        // 3️⃣ Send to Brevo
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify({
            sender: { name: "Deepak Team", email: senderEmail },
            to: recipients, // customer + admin
            subject,
            htmlContent,
          }),
        });

        // 4️⃣ Log result
        const data = await res.json();
        console.log("📧 Brevo email response:", data);
      } catch (err) {
        console.error("❌ Brevo email error:", err);
      }
    }
    // await sendBrevoEmail("youremail@gmail.com", "Mollie Test Email", "This is a test message from webhook.");


// 💰 1️⃣ Initial Payment Success
if (status === "paid" && sequence === "first") {
	const cacheKey = `initial-${payment.id}`;
	
   // 🚧 Store immediately (before doing anything async)
  if (processedPayments.has(cacheKey)) {
    console.log(`⚠️ Duplicate Mollie initial payment ignored for ${payment.id}`);
    return res.status(200).send("Duplicate ignored");
  }
  processedPayments.add(cacheKey);   // ✅ store right now

  // 🔔 Telegram Notification
  await sendTelegram(
    `💰 *INITIAL PAYMENT SUCCESSFUL*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n🏦 *Source:* Mollie\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n📦 *Plan:* ${planType}\n💵 *Initial:* ${currency} ${amount}\n🔁 *Recurring:* ${currency} ${recurringAmount}\n🆔 *Payment ID:* ${payment.id}\n🧾 *Customer ID:* ${customerId}${isRecurring ? "\n⏳ Waiting 8 seconds before creating subscription…" : "\n✅ One-time purchase — no subscription."}`
  );

  // 💌 Brevo Email for Payment Confirmation
  const emailBody = `
🏦 Source: Mollie
💰 INITIAL PAYMENT SUCCESSFUL
📧 Email: ${email}
👤 Name: ${name}
📦 Plan: ${planType}
💵 Initial: ${currency} ${amount}
🔁 Recurring: ${currency} ${recurringAmount}
🆔 Payment ID: ${payment.id}
🧾 Customer ID: ${customerId}
🕒 Time: ${timeCET} (CET)

Your payment has been received successfully.
${isRecurring ? "Your subscription will be created shortly." : "This was a one-time payment."}

Warm regards,
Deepak Team
support@realcoachdeepak.com
`;
  await sendBrevoEmail(email, `Payment Confirmation – ${planType}`, emailBody);

  // 🕗 Delay for subscription creation
  if (!isRecurring) return res.status(200).send("OK");

  await new Promise(r => setTimeout(r, 8000));

  // 🧾 Create subscription after initial payment
  const subRes = await fetch(
    `https://api.mollie.com/v2/customers/${customerId}/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOLLIE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: { value: recurringAmount, currency: "EUR" },
        interval: "1 month",
        description: `${planType} Subscription`,
        metadata: { email, name, planType },
      }),
    }
  );

  const subscription = await subRes.json();
  if (subscription.id) {
    // ⚙️ Prevent duplicate subscription messages
    if (processedPayments.has(`sub-${subscription.id}`)) {
      console.log(`⚠️ Duplicate Mollie subscription start ignored for ${subscription.id}`);
      return res.status(200).send("Duplicate ignored");
    }
    processedPayments.add(`sub-${subscription.id}`);

    await sendTelegram(
      `🧾 *SUBSCRIPTION STARTED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n🏦 *Source:* Mollie\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n📦 *Plan:* ${planType}\n💳 *Recurring:* ${currency} ${recurringAmount}\n🧾 *Subscription ID:* ${subscription.id}\n🆔 *Customer ID:* ${customerId}`
    );

    const subEmailBody = `
🏦 Source: Mollie
🧾 SUBSCRIPTION STARTED
📧 Email: ${email}
👤 Name: ${name}
📦 Plan: ${planType}
💳 Recurring: ${currency} ${recurringAmount}
🧾 Subscription ID: ${subscription.id}
🆔 Customer ID: ${customerId}
🕒 Time: ${timeCET} (CET)

Your subscription has been created successfully.
Warm regards,
Deepak Team
support@realcoachdeepak.com
`;
    await sendBrevoEmail(email, `Subscription Started – ${planType}`, subEmailBody);
  } else {
    await sendTelegram(
      `🚫 *SUBSCRIPTION CREATION FAILED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n👤 *Name:* ${name}\n🧾 *Customer ID:* ${customerId}`
    );

    const failEmailBody = `
🏦 Source: Mollie
🚫 SUBSCRIPTION CREATION FAILED
📧 Email: ${email}
👤 Name: ${name}
🧾 Customer ID: ${customerId}
🕒 Time: ${timeCET} (CET)

We could not start your subscription automatically. Please contact support if this persists.
Warm regards,
Deepak Team
support@realcoachdeepak.com
`;
    await sendBrevoEmail(email, `Subscription Creation Failed – ${planType}`, failEmailBody);
  }
}


    // 🔁 2️⃣ Renewal Paid
    else if (status === "paid" && sequence === "recurring") {
      await sendTelegram(
        `🔁 *RENEWAL CHARGED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // ⚠️ 3️⃣ Renewal Failed
    else if (status === "failed" && sequence === "recurring") {
      await sendTelegram(
        `⚠️ *RENEWAL FAILED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // ❌ 4️⃣ Initial Payment Failed  (handles missing sequenceType)
    else if (status === "failed" && sequence !== "recurring") {
      const failType =
        sequence === "first" ? "INITIAL PAYMENT FAILED" : "PAYMENT FAILED (UNSPECIFIED)";
      await sendTelegram(
        `❌ *${failType}*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // 🕓 5️⃣ Payment Open (new)
    else if (status === "open") {
      await sendTelegram(
        `🕓 *PAYMENT PENDING / OPEN*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n💬 *Status:* Awaiting user completion`
      );
    }

    // ⌛ 6️⃣ Payment Expired (new)
    else if (status === "expired") {
      await sendTelegram(
        `⌛ *PAYMENT EXPIRED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n💵 *Amount:* ${currency} ${amount}\n💬 *Status:* User didn’t complete checkout`
      );
    }

    // 🚫 7️⃣ Subscription Cancelled
    else if (body.resource === "subscription" && body.status === "canceled") {
      await sendTelegram(
        `🚫 *SUBSCRIPTION CANCELLED*\n━━━━━━━━━━━━━━━\n🕒 *Time:* ${timeCET} (CET)\n📧 *Email:* ${email}\n📦 *Plan:* ${planType}\n🧾 *Customer ID:* ${customerId}`
      );
    }

    // 💤 Fallback
    else {
      console.log(`ℹ️ Payment status: ${status}, sequence: ${sequence}`);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Mollie Webhook Error:", err);
    res.status(500).send("Internal error");
  }
}

