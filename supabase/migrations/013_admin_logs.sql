-- Create admin_logs table to track user interactions
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view logs (shared workspace)
CREATE POLICY "Authenticated users can select admin_logs"
    ON public.admin_logs FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated users can insert their own logs
CREATE POLICY "Authenticated users can insert admin_logs"
    ON public.admin_logs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
