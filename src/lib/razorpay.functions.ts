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
    const amountPaise = Math.round(data.amount * 100);

    const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        payment_capture: 1,
        receipt: `rcpt_${Date.now()}_${userId.slice(0, 8)}`,
        notes: { user_id: userId, purpose: data.purpose, plan: data.plan ?? "" },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Razorpay order create failed", res.status, text);
      throw new Error(`Could not create payment order: ${text.slice(0, 200)}`);
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };

    const bonusAmount = data.purpose === "bonus" ? data.amount * BONUS_PER_RUPEE : null;

    const { error } = await (supabaseAdmin as any).from("payment_orders").insert({
      user_id: userId,
      razorpay_order_id: order.id,
      amount: data.amount,
      currency: order.currency,
      status: "created",
      purpose: data.purpose,
      bonus_amount: bonusAmount,
      plan: data.plan ?? null,
    });
    if (error) {
      console.error("Failed to record payment order", error);
      // Fallback retry without `plan` column in case it doesn't exist on payment_orders
      const { error: e2 } = await (supabaseAdmin as any).from("payment_orders").insert({
        user_id: userId,
        razorpay_order_id: order.id,
        amount: data.amount,
        currency: order.currency,
        status: "created",
        purpose: data.purpose,
        bonus_amount: bonusAmount,
      });
      if (e2) throw new Error(
        `Could not record payment order: ${e2.message ?? "unknown"}${e2.code ? ` (${e2.code})` : ""}${e2.hint ? ` — ${e2.hint}` : ""}`,
      );
    }

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      purpose: data.purpose,
      bonusAmount,
      plan: data.plan ?? null,
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
      .select("id, user_id, amount, status, purpose, bonus_amount, plan")
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

    const purpose: "deposit" | "bonus" | "subscription" = order.purpose ?? "deposit";

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
          link: "/subscription",
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
