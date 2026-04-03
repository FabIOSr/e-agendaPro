-- ============================================================
-- MIGRATION 28: Personalização da página pública do prestador
-- ============================================================
-- Adiciona campos que permitem diferenciação visual e de conteúdo
-- entre planos free e pro na pagina-cliente.html

-- Cor de destaque da página (hex, ex: #2d5a27)
ALTER TABLE public.prestadores
  ADD COLUMN IF NOT EXISTS cor_tema TEXT DEFAULT NULL;

-- Categoria do profissional (para ícones e copy adaptados)
ALTER TABLE public.prestadores
  ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT NULL
  CHECK (categoria IS NULL OR categoria IN (
    'beleza', 'saude', 'fitness', 'educacao', 'terapia', 'estetica', 'outro'
  ));

-- Endereço curto para exibição no hero (ex: "Pinheiros, São Paulo")
-- Já existe cidade e endereco — este campo é o texto formatado para exibição
ALTER TABLE public.prestadores
  ADD COLUMN IF NOT EXISTS local_exibicao TEXT DEFAULT NULL;

-- Galeria de fotos (array de URLs do Supabase Storage) — exclusivo Pro
ALTER TABLE public.prestadores
  ADD COLUMN IF NOT EXISTS galeria_urls TEXT[] DEFAULT NULL;

-- Índice para busca por categoria (futuro marketplace)
CREATE INDEX IF NOT EXISTS idx_prestadores_categoria
  ON public.prestadores(categoria)
  WHERE categoria IS NOT NULL;

SELECT 'Migration 28 OK - campos de personalização adicionados' AS status;
