CREATE TABLE public.scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  script jsonb,
  feedback text,
  error text,
  version int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.scripts TO anon, authenticated;
GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read scripts" ON public.scripts FOR SELECT TO anon, authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.scripts;