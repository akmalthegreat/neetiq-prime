-- ============================================================================
-- NEETIQ Prime — Battlegrounds reliability patch
-- Adds:
--   1. bg_force_finalize_match(_match_id) — if the caller has submitted but the
--      opponent has been idle past the total time window, declare the caller
--      winner (or refund on tie). Safe to call repeatedly.
--   2. bg_forfeit_match(_match_id) — caller forfeits the match: opponent is
--      declared winner (paid stake → 85% prize, free → glory). Used on quit /
--      tab close / explicit leave.
-- ============================================================================

-- Total time per match: 5 questions × 25 seconds + 20s grace = 145s
CREATE OR REPLACE FUNCTION public.bg_force_finalize_match(_match_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _m public.battle_matches;
  _me public.battle_match_players;
  _opp public.battle_match_players;
  _prize numeric;
  _started_at timestamptz;
  _grace_sec int := 145;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _m FROM public.battle_matches WHERE id = _match_id FOR UPDATE;
  IF _m.id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF _m.status = 'finished' THEN RETURN jsonb_build_object('status','finished'); END IF;
  IF _m.is_bot_match THEN RETURN jsonb_build_object('status', _m.status); END IF;

  SELECT * INTO _me  FROM public.battle_match_players WHERE match_id=_match_id AND user_id=_uid;
  SELECT * INTO _opp FROM public.battle_match_players WHERE match_id=_match_id AND user_id<>_uid;
  IF _me.user_id IS NULL THEN RAISE EXCEPTION 'Not a participant'; END IF;

  _started_at := COALESCE(_m.countdown_starts_at, _m.created_at);

  -- Caller hasn't submitted yet — nothing to force.
  IF _me.submitted_at IS NULL THEN
    RETURN jsonb_build_object('status','waiting_self');
  END IF;

  -- Opponent submitted → run normal scoring path.
  IF _opp.submitted_at IS NOT NULL THEN
    -- Delegate to the standard scorer
    RETURN public.bg_submit_match_score(_match_id, _me.score);
  END IF;

  -- Opponent has NOT submitted. Has enough time passed?
  IF now() < _started_at + (_grace_sec || ' seconds')::interval THEN
    RETURN jsonb_build_object('status','waiting_opponent');
  END IF;

  -- Force win for caller (opponent timed out / abandoned).
  _prize := CASE WHEN _m.stake = 0 THEN 0 ELSE round(_m.stake * 2 * 0.85, 2) END;
  IF _prize > 0 THEN
    UPDATE public.profiles
       SET winnings_balance = winnings_balance + _prize,
           wallet_balance   = wallet_balance   + _prize
     WHERE id = _uid;
    INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference)
      VALUES (_uid, _prize, 'battle_prize', 'winnings', 'completed', _match_id::text);
  END IF;
  -- Mark opponent as auto-submitted with current score (could be 0)
  UPDATE public.battle_match_players
     SET submitted_at = now()
   WHERE match_id = _match_id AND user_id = _opp.user_id AND submitted_at IS NULL;

  UPDATE public.battle_matches
     SET status='finished', winner_user_id=_uid, prize_amount=_prize
   WHERE id=_match_id;

  RETURN jsonb_build_object('status','finished','winner',_uid,'prize',_prize,'reason','opponent_timeout');
END $$;

GRANT EXECUTE ON FUNCTION public.bg_force_finalize_match(uuid) TO authenticated;


-- Caller voluntarily quits → opponent wins.
CREATE OR REPLACE FUNCTION public.bg_forfeit_match(_match_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _m public.battle_matches;
  _opp public.battle_match_players;
  _prize numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _m FROM public.battle_matches WHERE id = _match_id FOR UPDATE;
  IF _m.id IS NULL OR _m.status = 'finished' OR _m.is_bot_match THEN
    RETURN jsonb_build_object('status', COALESCE(_m.status,'not_found'));
  END IF;

  SELECT * INTO _opp FROM public.battle_match_players WHERE match_id=_match_id AND user_id<>_uid;
  IF _opp.user_id IS NULL THEN
    -- No opponent — just refund caller if paid.
    IF _m.stake > 0 THEN
      UPDATE public.profiles
         SET deposit_balance = deposit_balance + _m.stake,
             wallet_balance  = wallet_balance  + _m.stake
       WHERE id = _uid;
    END IF;
    UPDATE public.battle_matches SET status='finished' WHERE id=_match_id;
    RETURN jsonb_build_object('status','finished','reason','no_opponent');
  END IF;

  -- Mark caller submitted with 0; opponent wins.
  UPDATE public.battle_match_players
     SET submitted_at = COALESCE(submitted_at, now())
   WHERE match_id=_match_id AND user_id=_uid;
  UPDATE public.battle_match_players
     SET submitted_at = COALESCE(submitted_at, now())
   WHERE match_id=_match_id AND user_id=_opp.user_id;

  _prize := CASE WHEN _m.stake = 0 THEN 0 ELSE round(_m.stake * 2 * 0.85, 2) END;
  IF _prize > 0 THEN
    UPDATE public.profiles
       SET winnings_balance = winnings_balance + _prize,
           wallet_balance   = wallet_balance   + _prize
     WHERE id = _opp.user_id;
    INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference)
      VALUES (_opp.user_id, _prize, 'battle_prize', 'winnings', 'completed', _match_id::text);
  END IF;

  UPDATE public.battle_matches
     SET status='finished', winner_user_id=_opp.user_id, prize_amount=_prize
   WHERE id=_match_id;

  RETURN jsonb_build_object('status','finished','winner',_opp.user_id,'prize',_prize,'reason','forfeit');
END $$;

GRANT EXECUTE ON FUNCTION public.bg_forfeit_match(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
