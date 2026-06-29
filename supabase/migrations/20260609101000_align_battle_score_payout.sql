-- Align normal 1v1 battleground payout with the app UI, bot battles, and timeout wins.
-- Winner receives 85% of the two-player pool; ties refund both stakes.

CREATE OR REPLACE FUNCTION public.bg_submit_match_score(_match_id uuid, _score numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _m public.battle_matches;
  _both int;
  _p1 public.battle_match_players;
  _p2 public.battle_match_players;
  _winner uuid;
  _prize numeric;
  _pool numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.battle_match_players
     SET score = _score,
         submitted_at = COALESCE(submitted_at, now())
   WHERE match_id = _match_id AND user_id = _uid;

  SELECT * INTO _m FROM public.battle_matches WHERE id = _match_id FOR UPDATE;
  IF _m.id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF _m.status <> 'active' THEN RETURN jsonb_build_object('status', _m.status); END IF;

  SELECT count(*) INTO _both
    FROM public.battle_match_players
   WHERE match_id = _match_id AND submitted_at IS NOT NULL;
  IF _both < 2 THEN RETURN jsonb_build_object('status','waiting_opponent'); END IF;

  SELECT * INTO _p1 FROM public.battle_match_players WHERE match_id = _match_id ORDER BY user_id LIMIT 1;
  SELECT * INTO _p2 FROM public.battle_match_players WHERE match_id = _match_id ORDER BY user_id OFFSET 1 LIMIT 1;

  _pool := _m.stake * 2;

  IF _p1.score = _p2.score THEN
    UPDATE public.battle_matches
       SET status = 'finished',
           winner_user_id = NULL,
           prize_amount = 0,
           ends_at = now()
     WHERE id = _match_id AND status = 'active';

    IF _m.stake > 0 THEN
      UPDATE public.profiles
         SET deposit_balance = deposit_balance + _m.stake,
             wallet_balance = wallet_balance + _m.stake
       WHERE id IN (_p1.user_id, _p2.user_id);

      INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference)
      VALUES
        (_p1.user_id, _m.stake, 'battle_refund', 'deposit', 'completed', _match_id::text),
        (_p2.user_id, _m.stake, 'battle_refund', 'deposit', 'completed', _match_id::text);
    END IF;

    RETURN jsonb_build_object('status','tie','prize',0);
  END IF;

  _winner := CASE WHEN _p1.score > _p2.score THEN _p1.user_id ELSE _p2.user_id END;
  _prize := CASE WHEN _m.stake = 0 THEN 0 ELSE round(_pool * 0.85, 2) END;

  UPDATE public.battle_matches
     SET status = 'finished',
         winner_user_id = _winner,
         prize_amount = _prize,
         ends_at = now()
   WHERE id = _match_id AND status = 'active';

  IF _prize > 0 THEN
    UPDATE public.profiles
       SET winnings_balance = winnings_balance + _prize,
           wallet_balance = wallet_balance + _prize
     WHERE id = _winner;

    INSERT INTO public.wallet_transactions (user_id, amount, type, bucket, status, reference)
    VALUES (_winner, _prize, 'battle_prize', 'winnings', 'completed', _match_id::text);
  END IF;

  RETURN jsonb_build_object('status','finished','winner',_winner,'prize',_prize);
END $$;

GRANT EXECUTE ON FUNCTION public.bg_submit_match_score(uuid, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
