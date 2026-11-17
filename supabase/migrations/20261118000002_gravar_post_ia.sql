-- PAT v2 · Etapa 4A: gravação condicional do texto da IA (função melhorar-posts).
-- Só grava se o post continuar igual ao que a IA leu (legenda, foto, situação, não postado) e ainda estiver
-- 'trabalhando' com o mesmo ia_em (ninguém o devolveu à fila nem outra execução o pegou de novo).
-- Feito no banco (e não com filtros na URL) porque a legenda lida pode ser longa demais para a URL.
-- Devolve true se gravou; false = o cliente mexeu (a ação dele vence).
create function public.gravar_post_ia(
  p_id uuid,
  p_ia_em timestamptz,
  p_legenda_lida text,
  p_foto_lida text,
  p_titulo text,
  p_legenda text,
  p_hashtags text[],
  p_roteiro text,
  p_foto_path text
) returns boolean
language sql
set search_path = ''
as $$
  with feito as (
    update public.posts set
      titulo = p_titulo,
      legenda = p_legenda,
      hashtags = coalesce(p_hashtags, '{}'),
      roteiro = p_roteiro,
      foto_path = p_foto_path,
      origem = 'ia',
      ia_estado = 'pronto'
    where id = p_id
      and ia_estado = 'trabalhando'
      and ia_em is not distinct from p_ia_em
      and legenda = p_legenda_lida
      and foto_path is not distinct from p_foto_lida
      and estado in ('gerado', 'reprovado')
      and postado_em is null
    returning 1
  )
  select exists (select 1 from feito)
$$;
revoke execute on function public.gravar_post_ia(uuid, timestamptz, text, text, text, text, text[], text, text)
  from public, anon, authenticated;
grant execute on function public.gravar_post_ia(uuid, timestamptz, text, text, text, text, text[], text, text)
  to service_role;
