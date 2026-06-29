import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MIN_AMOUNT = 10;
const MAX_AMOUNT = 100000;

// Bonus packs: ₹10 → 10 bonus (1:1).
const BONUS_PER_RUPEE = 10;

/** Create a Razorpay order. `purpose` decides where the credit lands. */
export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        amount: z.number().min(MIN_AMOUNT).max(MAX_AMOUNT),
        purpose: z.enum(["deposit", "bonus", "subscription", "batch"]).default("deposit"),
        plan: z.enum(["monthly", "yearly"]).optional(),
        batch_id: z.string().uuid().optional(),
        coupon_code: z.string().min(1).max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay is not configured");
    const userId = context.userId;

    // Server-side authoritative pricing for batch purchases.
    let finalAmount = Number(data.amount);
    let batchRow: any = null;
    let couponInfo: { id: string; discount: number } | null = null;
    if (data.purpose === "batch") {
      if (!data.batch_id) throw new Error("batch_id required");
      const { data: b } = await (supabaseAdmin as any).from("batches").select("*").eq("id", data.batch_id).maybeSingle();
      if (!b || !b.active) throw new Error("Batch not available");
      batchRow = b;
      let base = Number(b.discounted_price);
      let discount = 0;
      if (data.coupon_code) {
        const { data: c } = await (supabaseAdmin as any).from("coupons").select("*").ilike("code", data.coupon_code.trim()).maybeSingle();
        if (!c || !c.active) throw new Error("Invalid coupon");
        if (c.expires_at && new Date(c.expires_at) < new Date()) throw new Error("Coupon expired");
        if (c.max_uses != null && c.used_count >= c.max_uses) throw new Error("Coupon usage limit reached");
        if (c.batch_id && c.batch_id !== b.id) throw new Error("Coupon not valid for this batch");
        const { data: already } = await (supabaseAdmin as any)
          .from("coupon_redemptions").select("id").eq("coupon_id", c.id).eq("user_id", userId).maybeSingle();
        if (already) throw new Error("Coupon already used");
        discount = c.kind === "percent" ? (base * Number(c.value)) / 100 : Number(c.value);
        discount = Math.min(discount, base);
        couponInfo = { id: c.id, discount };
      }
      finalAmount = Math.max(1, Math.round((base - discount) * 100) / 100);
    }
    const amountPaise = Math.round(finalAmount * 100);

    const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        payment_capture: 1,
        receipt: `rcpt_${Date.now()}_${userId.slice(0, 8)}`,
        notes: { user_id: userId, purpose: data.purpose, plan: data.plan ?? "", batch_id: data.batch_id ?? "" },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Razorpay order create failed", res.status, text);
      throw new Error(`Could not create payment order: ${text.slice(0, 200)}`);
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };

    const bonusAmount = data.purpose === "bonus" ? data.amount * BONUS_PER_RUPEE : null;

    const insertRow: any = {
      user_id: userId,
      razorpay_order_id: order.id,
      amount: finalAmount,
      currency: order.currency,
      status: "created",
      purpose: data.purpose,
      bonus_amount: bonusAmount,
      plan: data.plan ?? null,
      batch_id: data.batch_id ?? null,
      coupon_id: couponInfo?.id ?? null,
      discount_amount: couponInfo?.discount ?? 0,
    };
    const { error } = await (supabaseAdmin as any).from("payment_orders").insert(insertRow);
    if (error) {
      console.error("Failed to record payment order", error);
      throw new Error(`Could not record payment order: ${error.message ?? "unknown"}`);
    }

    if (data.purpose === "batch" && batchRow) {
      await (supabaseAdmin as any).from("batch_purchases").insert({
        user_id: userId,
        batch_id: batchRow.id,
        coupon_id: couponInfo?.id ?? null,
        amount_paid: finalAmount,
        mrp: Number(batchRow.price),
        discount_amount: (Number(batchRow.price) - finalAmount),
        status: "pending",
        razorpay_order_id: order.id,
      });
    }

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      purpose: data.purpose,
      bonusAmount,
      plan: data.plan ?? null,
      finalAmount,
    };
  });

/** Verify Razorpay checkout signature and credit wallet or bonus. Idempotent. */
export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        razorpay_order_id: z.string().min(5).max(100),
        razorpay_payment_id: z.string().min(5).max(100),
        razorpay_signature: z.string().min(5).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Razorpay is not configured");
    const userId = context.userId;

    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    const sigBuf = Buffer.from(data.razorpay_signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new Error("Invalid payment signature");
    }

    const { data: order, error: orderErr } = await (supabaseAdmin as any)
      .from("payment_orders")
      .select("id, user_id, amount, status, purpose, bonus_amount, plan, batch_id, coupon_id")
      .eq("razorpay_order_id", data.razorpay_order_id)
      .maybeSingle();
    if (orderErr || !order) throw new Error("Order not found");
    if (order.user_id !== userId) throw new Error("Order does not belong to user");

    const keyId = process.env.RAZORPAY_KEY_ID!;
    const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const payRes = await fetch(
      `https://api.razorpay.com/v1/payments/${data.razorpay_payment_id}`,
      { headers: { Authorization: auth } },
    );
    if (payRes.status === 401 || payRes.status === 403) {
      const txt = await payRes.text();
      console.error("Razorpay auth failed", payRes.status, txt);
      throw new Error("Razorpay credentials invalid. Check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.");
    }
    if (!payRes.ok) {
      const txt = await payRes.text();
      console.error("Razorpay payment fetch failed", payRes.status, txt);
      throw new Error("Could not verify payment with Razorpay");
    }
    let pay = (await payRes.json()) as { status: string; amount: number; order_id: string };
    if (pay.order_id !== data.razorpay_order_id) throw new Error("Payment / order mismatch");

    // If authorized but not captured, capture it now.
    if (pay.status === "authorized") {
      const capRes = await fetch(
        `https://api.razorpay.com/v1/payments/${data.razorpay_payment_id}/capture`,
        {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify({ amount: pay.amount, currency: "INR" }),
        },
      );
      if (!capRes.ok) {
        const txt = await capRes.text();
        console.error("Razorpay capture failed", capRes.status, txt);
        throw new Error(`Could not capture payment: ${txt.slice(0, 200)}`);
      }
      pay = (await capRes.json()) as typeof pay;
    }

    if (pay.status !== "captured") {
      throw new Error(`Payment not successful (status: ${pay.status})`);
    }
    if (Math.round(Number(order.amount) * 100) !== pay.amount) {
      throw new Error("Amount mismatch");
    }

    const purpose: "deposit" | "bonus" | "subscription" | "batch" = order.purpose ?? "deposit";

    if (purpose === "batch") {
      // Activate premium for batch duration; mark purchase active; redeem coupon.
      const { data: batch } = await (supabaseAdmin as any).from("batches").select("id, title, duration_days").eq("id", order.batch_id).maybeSingle();
      if (!batch) throw new Error("Batch missing");
      const expires = new Date(Date.now() + batch.duration_days * 86400000).toISOString();
      await (supabaseAdmin as any).from("subscriptions").insert({
        user_id: userId, plan: "monthly", status: "active",
        started_at: new Date().toISOString(), expires_at: expires,
        razorpay_payment_id: data.razorpay_payment_id, razorpay_order_id: data.razorpay_order_id,
        source: "batch", source_batch_id: batch.id,
      });
      await (supabaseAdmin as any).from("batch_purchases")
        .update({ status: "active", razorpay_payment_id: data.razorpay_payment_id })
        .eq("razorpay_order_id", data.razorpay_order_id);
      if (order.coupon_id) {
        const { data: purch } = await (supabaseAdmin as any).from("batch_purchases").select("id").eq("razorpay_order_id", data.razorpay_order_id).maybeSingle();
        await (supabaseAdmin as any).from("coupon_redemptions").insert({
          coupon_id: order.coupon_id, user_id: userId, purchase_id: purch?.id ?? null,
        });
        await (supabaseAdmin as any).rpc("exec_sql"); // noop; increment below
        await (supabaseAdmin as any).from("coupons").update({ used_count: ((await (supabaseAdmin as any).from("coupons").select("used_count").eq("id", order.coupon_id).single()).data?.used_count ?? 0) + 1 }).eq("id", order.coupon_id);
      }
      try {
        const { pushNotification } = await import("@/lib/notifications.functions");
        await pushNotification({
          user_id: userId, kind: "deposit",
          title: `${batch.title} activated 👑`,
          body: `Premium valid till ${new Date(expires).toLocaleDateString()}.`,
          link: "/premium",
        });
      } catch (e) { console.error("notify batch failed", e); }
      return { success: true, credited: true, amount: Number(order.amount), purpose, expires_at: expires } as any;
    }

    if (purpose === "subscription") {
      const plan = (order.plan ?? "monthly") as "monthly" | "yearly";
      const { activateSubscriptionForUser } = await import("@/lib/subscriptions.functions");
      const { expires_at } = await activateSubscriptionForUser({
        userId, plan,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_order_id: data.razorpay_order_id,
      });
      try {
        const { pushNotification } = await import("@/lib/notifications.functions");
        await pushNotification({
          user_id: userId, kind: "deposit",
          title: `Premium ${plan} activated 👑`,
          body: `Valid till ${new Date(expires_at).toLocaleDateString()}.`,
          link: "/premium",
        });
      } catch (e) { console.error("notify sub failed", e); }
      return { success: true, credited: true, amount: Number(order.amount), purpose, plan, expires_at } as any;
    }


    if (purpose === "bonus") {
      const bonusAmount = Number(order.bonus_amount ?? Number(order.amount) * BONUS_PER_RUPEE);
      const { data: credited, error: creditErr } = await (supabaseAdmin as any).rpc(
        "credit_bonus_for_payment",
        {
          _user_id: userId,
          _amount: Number(order.amount),
          _bonus_amount: bonusAmount,
          _razorpay_payment_id: data.razorpay_payment_id,
          _razorpay_order_id: data.razorpay_order_id,
        },
      );
      if (creditErr) {
        console.error("Bonus credit failed", creditErr);
        throw new Error("Could not credit bonus");
      }
      if (credited) {
        try {
          const { pushNotification } = await import("@/lib/notifications.functions");
          await pushNotification({
            user_id: userId,
            kind: "deposit",
            title: `+${bonusAmount} bonus credited`,
            body: `Payment ${data.razorpay_payment_id} confirmed.`,
            link: "/wallet",
          });
        } catch (e) { console.error("notify bonus failed", e); }
      }
      return { success: true, credited: !!credited, amount: Number(order.amount), bonusAmount, purpose };
    }

    // Default: deposit
    const { data: credited, error: creditErr } = await supabaseAdmin.rpc(
      "credit_wallet_for_payment",
      {
        _user_id: userId,
        _amount: Number(order.amount),
        _razorpay_payment_id: data.razorpay_payment_id,
        _razorpay_order_id: data.razorpay_order_id,
      },
    );
    if (creditErr) {
      console.error("Wallet credit failed", creditErr);
      throw new Error("Could not credit wallet");
    }

    if (credited) {
      try {
        const { pushNotification } = await import("@/lib/notifications.functions");
        await pushNotification({
          user_id: userId,
          kind: "deposit",
          title: `₹${Number(order.amount)} added to wallet`,
          body: `Payment ${data.razorpay_payment_id} confirmed.`,
          link: "/wallet",
        });
      } catch (e) { console.error("notify deposit failed", e); }
    }

    return { success: true, credited: !!credited, amount: Number(order.amount), purpose };
  });
