## Execution order (per your request)

This is a very large piece of work. I'll deliver it in shippable chunks, each verifiable in the preview before moving to the next. Phase 1 (custom Supabase wiring) is already done.

---

### Phase 3 — Premium Batches, Coupons, Order Summary, Admin Grants

**DB schema (one migration)**
- `batches` (image, title, price, discounted_price, features jsonb, ai_description, duration_days, active, sort)
- `batch_purchases` (user_id, batch_id, coupon_id, amount_paid, razorpay_*, status)
- `coupons` (code unique, type [percent|flat], value, max_uses, used_count, expires_at, batch_id nullable, active)
- `coupon_redemptions` (coupon_id, user_id, purchase_id)
- Extend `subscriptions` flow so a paid batch grants premium for `duration_days`
- RLS + GRANTs per project rules

**Admin pages (new tabs in `/admin`)**
- **Add Batch**: image upload → Storage `batch-images` bucket; title; checkboxes for ALL premium features (Daily DPP, AI Mock Tests, Unlimited AI quizzes, Flashcards, NCERT Highlights, PYQs, Contests, Battlegrounds, Analytics, Score Predictor, NEETLab simulations, Bookmarks, Priority support); price + discounted price; duration days; "Generate description with AI" button (Lovable AI Gateway) producing the user-facing features blurb.
- **Coupons**: create code, type, value, usage cap, expiry, optional batch scope, toggle active.
- **User Stats → Grant Premium**: button on user report to grant N days of premium directly (writes a `subscriptions` row, status active).

**User flow**
- `/premium` (renamed from current `/subscription`) shows batch cards from DB.
- "Buy" opens an **Order Summary modal**: image, title, MRP strike-through, discounted price, coupon code input (Apply / Remove), final payable, Pay with Razorpay button.
- Verify endpoint applies coupon redemption + creates batch_purchase + subscription row.
- Keep monthly/yearly Razorpay plans as fallback for now (or remove if you confirm).

---

### Phase 4 — NEETLab integration

- Rename dashboard tile "NEET PYQs" → **NEETLab**; route `/neetlab` (keep `/pyqs` as alias).
- Port `interactive-science-lab` UI into `/neetlab` with sub-routes: `/neetlab/physics`, `/neetlab/chemistry`, `/neetlab/biology`.
- Rebrand using your existing `PageShell`, tokens from `index.css`, lucide icons — no separate look.
- Add 3D physics simulations using **react-three-fiber** + free open-source sims (projectile motion, pendulum, optics, circuit). Use existing components from the integration zip + add 2–3 new sims with @react-three/fiber + drei (all free).
- Gate behind premium (Phase 2).

---

### Phase 2 — Suspend bonus, gate premium

- Add `app_settings` flag `bonus_suspended=true` (already supported).
- `/bonus` route renders "Bonus temporarily disabled — buy premium to continue." (files preserved, not deleted).
- Global `<PremiumGate>` HOC: if user is not premium AND route is in `PREMIUM_ROUTES` → redirect to `/premium`. Applied to all feature routes except `/`, `/login`, `/premium`, `/profile`, `/dashboard` (which itself shows locked overlays on tiles).
- `useAuth` already exposes premium status via `getMySubscription` — wire it in.

---

### AI Mock Test question-count fix

- Root cause in `ai-mock-batch` / `generateAiDailyQuizzes`: AI ignores requested count, returns variable JSON length. Fix by:
  - Enforcing `count` in prompt + schema validation (Zod array length).
  - If model returns fewer, loop-retry the missing slice up to 3 times.
  - If returns more, slice to exact count.
  - Reject (and retry) any batch whose count ≠ requested.
- Add server-side guard so a mock with <requested count is never persisted.

---

### Technical details

- Storage: new public bucket `batch-images` via storage tool (not SQL).
- AI: Lovable AI Gateway `google/gemini-3-flash-preview` for batch description generation. Will enable gateway if not already.
- Coupons applied server-side in `verifyRazorpayPayment` to prevent client tampering.
- All admin server fns guarded with `requireSupabaseAuth` + `has_role(uid, 'admin')`.
- NEETLab 3D: `@react-three/fiber`, `@react-three/drei`, `three` (MIT, free).
- No edits to existing migrations; one new migration per phase.

I'll start with Phase 3 DB + admin Add Batch + Order Summary as the first shippable chunk, then continue. Reply **go** to start, or tell me to reorder/skip anything.