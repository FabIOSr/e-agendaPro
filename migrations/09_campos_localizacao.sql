-- Migration 09: Adiciona campos de localização ao prestador
-- Rodar no Supabase SQL Editor

-- Adiciona cidade e endereço ao perfil do prestador
ALTER TABLE public.prestadores 
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT;

-- Cria bucket de avatars se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Política de acesso aos avatars
DROP POLICY IF EXISTS "public read avatars" ON storage.objects;
CREATE POLICY "public read avatars" ON storage.objects 
FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "authenticated upload avatars" ON storage.objects;
CREATE POLICY "authenticated upload avatars" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated update avatars" ON storage.objects;
CREATE POLICY "authenticated update avatars" ON storage.objects 
FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "owner manage avatars" ON storage.objects;
CREATE POLICY "owner manage avatars" ON storage.objects 
FOR ALL USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
