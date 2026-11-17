-- PAT v2 · Etapa 4A: gravação condicional da legenda reescrita na hora pela IA (função reescrever-post, depois do
-- "Trocar imagem"). Como gravar_post_ia, mas sem exigir 'trabalhando' (o post não veio da fila): só grava se o post
-- continuar igual ao que foi lido (legenda, foto, "sem foto", situação, não postado). A foto não muda.
-- Feito no banco (e não com filtros na URL) porque a legenda lida pode ser longa demais para a URL.
-- Marca origem 'ia' e ia_estado 'pronto': a fila não reescreve de novo o que o cliente acabou de ver.
-- Devolve true se gravou; false = o post mudou enquanto a IA escrevia (a ação do cliente vence).
create function public.gravar_reescrita_ia(
  p_id uuid,
  p_legenda_lida text,
  p_foto_lida text,
  p_estado_lido text,
  p_sem_foto_lido boolean,
  p_titulo text,
  p_legenda text,
  p_hashtags text[],
  p_roteiro text
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
      origem = 'ia',
      ia_estado = 'pronto'
    where id = p_id
      and legenda = p_legenda_lida
      and foto_path is not distinct from p_foto_lida
      and estado = p_estado_lido
      and estado in ('gerado', 'reprovado')
      and sem_foto = p_sem_foto_lido
      and postado_em is null
    returning 1
  )
  select exists (select 1 from feito)
$$;
revoke execute on function public.gravar_reescrita_ia(uuid, text, text, text, boolean, text, text, text[], text)
  from public, anon, authenticated;
grant execute on function public.gravar_reescrita_ia(uuid, text, text, text, boolean, text, text, text[], text)
  to service_role;
