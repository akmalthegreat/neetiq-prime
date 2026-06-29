-- Add purpose + bonus_amount columns required by createRazorpayOrder insert.
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'deposit',
  ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(10,2);
