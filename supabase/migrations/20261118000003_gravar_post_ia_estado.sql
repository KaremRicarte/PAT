-- PAT v2 · Etapa 4A: a gravação condicional da IA também exige a mesma situação (estado) e o mesmo "sem foto"
-- que a IA leu: se o cliente reprovar o post ou marcar "sem foto" enquanto a IA escreve, a ação dele vence.
-- A lista de parâmetros muda, então a versão de 20261118000002 sai (create or replace não troca a assinatura).
drop function if exists public.gravar_post_ia(uuid, timestamptz, text, text, text, text, text[], text, text);

create function public.gravar_post_ia(
  p_id uuid,
  p_ia_em timestamptz,
  p_legenda_lida text,
  p_foto_lida text,
  p_estado_lido text,
  p_sem_foto_lido boolean,
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
      and estado = p_estado_lido
      and estado in ('gerado', 'reprovado')
      and sem_foto = p_sem_foto_lido
      and postado_em is null
    returning 1
  )
  select exists (select 1 from feito)
$$;
revoke execute on function public.gravar_post_ia(uuid, timestamptz, text, text, text, boolean, text, text, text[], text, text)
  from public, anon, authenticated;
grant execute on function public.gravar_post_ia(uuid, timestamptz, text, text, text, boolean, text, text, text[], text, text)
  to service_role;
