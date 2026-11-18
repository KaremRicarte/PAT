-- PAT v2 · imagem gerada por IA (fal.ai FLUX): novo tipo 'gerada' e contagem mensal separada.

alter table public.fotos_ia drop constraint if exists fotos_ia_origem_check;
alter table public.fotos_ia add constraint fotos_ia_origem_check
  check (origem in ('cliente', 'banco', 'pexels', 'pixabay', 'gerada'));

alter table public.uso_ia drop constraint if exists uso_ia_tipo_check;
alter table public.uso_ia add constraint uso_ia_tipo_check
  check (tipo in ('foto', 'post', 'troca', 'imagem', 'gerada'));

-- chamadas de IA no mês (limite de 400): as imagens geradas ficam de fora, têm limite próprio
create or replace function public.uso_ia_no_mes(p_cliente uuid) returns int
language sql stable
set search_path = ''
as $$
  select count(*)::int from public.uso_ia
  where cliente_id = p_cliente
    and tipo <> 'gerada'
    and (criado_em at time zone 'America/Sao_Paulo') >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
$$;
revoke execute on function public.uso_ia_no_mes(uuid) from public, anon, authenticated;
grant execute on function public.uso_ia_no_mes(uuid) to service_role;

-- imagens geradas no mês do calendário (São Paulo)
create or replace function public.uso_ia_geradas_no_mes(p_cliente uuid) returns int
language sql stable
set search_path = ''
as $$
  select count(*)::int from public.uso_ia
  where cliente_id = p_cliente
    and tipo = 'gerada'
    and (criado_em at time zone 'America/Sao_Paulo') >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
$$;
revoke execute on function public.uso_ia_geradas_no_mes(uuid) from public, anon, authenticated;
grant execute on function public.uso_ia_geradas_no_mes(uuid) to service_role;
