import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Razorpay webhook endpoint. Subscribe to: payment.captured, payment.failed, order.paid.
 * URL: <site>/api/public/razorpay/webhook
 */
export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
          console.error("RAZORPAY_WEBHOOK_SECRET not configured");
          return new Response("Server misconfigured", { status: 500 });
        }
        const signature = request.headers.get("x-razorpay-signature");
        const body = await request.text();
        if (!signature) {
          return new Response("Missing signature", { status: 401 });
        }
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = payload?.event as string | undefined;
        const payment = payload?.payload?.payment?.entity as
          | { id: string; order_id: string; amount: number; status: string }
          | undefined;

        try {
          if (event === "payment.captured" || event === "order.paid") {
            if (!payment?.id || !payment?.order_id) {
              return new Response("Missing payment fields", { status: 400 });
            }
            const { data: order } = await supabaseAdmin
              .from("payment_orders")
              .select("user_id, amount")
              .eq("razorpay_order_id", payment.order_id)
              .maybeSingle();
            if (!order) {
              console.warn("Webhook: order not found", payment.order_id);
              return new Response("ok", { status: 200 });
            }
            if (Math.round(Number(order.amount) * 100) !== payment.amount) {
              console.error("Webhook amount mismatch", order, payment);
              return new Response("Amount mismatch", { status: 400 });
            }
            await supabaseAdmin.rpc("credit_wallet_for_payment", {
              _user_id: order.user_id,
              _amount: Number(order.amount),
              _razorpay_payment_id: payment.id,
              _razorpay_order_id: payment.order_id,
            });
          } else if (event === "payment.failed") {
            if (payment?.order_id) {
              await supabaseAdmin
                .from("payment_orders")
                .update({ status: "failed" })
                .eq("razorpay_order_id", payment.order_id);
            }
          }
        } catch (e) {
          console.error("Webhook processing error", e);
          return new Response("Server error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
