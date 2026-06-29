ALTER TABLE public.ai_api_keys ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_api_keys TO authenticated;
GRANT ALL ON public.ai_api_keys TO service_role;

DROP POLICY IF EXISTS "Admins manage ai keys" ON public.ai_api_keys;
CREATE POLICY "Admins manage ai keys"
ON public.ai_api_keys
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));