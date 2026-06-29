-- Fix battleground waiting screens on the live schema.
-- battle_matches has started_at, not created_at.

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
  _claimed boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _m FROM public.battle_matches WHERE id = _match_id FOR UPDATE;
  IF _m.id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF _m.status = 'finished' THEN
    RETURN jsonb_build_object('status','finished','winner',_m.winner_user_id,'prize',_m.prize_amount);
  END IF;
  IF _m.is_bot_match THEN RETURN jsonb_build_object('status', _m.status); END IF;

  SELECT * INTO _me FROM public.battle_match_players WHERE match_id=_match_id AND user_id=_uid;
  SELECT * INTO _opp FROM public.battle_match_players WHERE match_id=_match_id AND user_id<>_uid;
  IF _me.user_id IS NULL THEN RAISE EXCEPTION 'Not a participant'; END IF;

  IF _me.submitted_at IS NULL THEN
    RETURN jsonb_build_object('status','waiting_self');
  END IF;

  IF _opp.submitted_at IS NOT NULL THEN
    RETURN public.bg_submit_match_score(_match_id, _me.score);
  END IF;

  _started_at := COALESCE(_m.countdown_starts_at, _m.started_at, now());
  IF now() < _started_at + (_grace_sec || ' seconds')::interval THEN
    RETURN jsonb_build_object('status','waiting_opponent');
  END IF;

  _prize := CASE WHEN _m.stake = 0 THEN 0 ELSE round(_m.stake * 2 * 0.85, 2) END;

  UPDATE public.battle_matches
     SET status='finished',
         winner_user_id=_uid,
         prize_amount=_prize,
         ends_at = now()
   WHERE id=_match_id AND status='active'
  RETURNING TRUE INTO _claimed;

  IF NOT COALESCE(_claimed, FALSE) THEN
    SELECT * INTO _m FROM public.battle_matches WHERE id=_match_id;
    RETURN jsonb_build_object('status','finished','winner',_m.winner_user_id,'prize',_m.prize_amount,'reason','already_finalized');
  END IF;

  IF _prize > 0 THEN
    UPDATE public.profiles
       SET winnings_balance = winnings_balance + _prize,
           wallet_balance   = wallet_balance   + _prize
     WHERE id = _uid;
    INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference)
      VALUES (_uid, _prize, 'battle_prize', 'winnings', 'completed', _match_id::text);
  END IF;

  UPDATE public.battle_match_players
     SET submitted_at = now()
   WHERE match_id = _match_id AND user_id = _opp.user_id AND submitted_at IS NULL;

  RETURN jsonb_build_object('status','finished','winner',_uid,'prize',_prize,'reason','opponent_timeout');
END $$;

GRANT EXECUTE ON FUNCTION public.bg_force_finalize_match(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
