-- PAT v2 · Datas especiais do mês e promoção com data.

-- Item: a promoção vale só perto desta data (aquecimento nos 7 dias antes e o post forte no dia).
-- Só faz sentido com preço promocional; sem data, a promoção vale o mês todo (como antes).
alter table public.produtos
  add column promo_data date
    check (promo_data is null or preco_promo is not null);

-- Post: a data especial dele, no momento da geração. { nome, data, fase }:
--   fase 'tema' (post do dia de uma data comemorativa), 'aquecimento' ou 'dia' (promoção com data).
-- O cliente não altera esta coluna (o grant de update do cliente é só por colunas).
alter table public.posts
  add column ocasiao jsonb
    check (ocasiao is null or (jsonb_typeof(ocasiao) = 'object' and ocasiao->>'fase' in ('tema', 'aquecimento', 'dia')));

-- criar_mes passa a gravar a ocasião de cada post. Mesma assinatura de antes; só a chave de serviço executa.
create or replace function public.criar_mes(
  p_cliente uuid, p_ano_mes text, p_estrategia text, p_origem text, p_posts jsonb,
  p_redes text[] default '{instagram,facebook,tiktok,whatsapp}'
) returns uuid
language plpgsql
set search_path = ''
as $$
declare v_mes uuid;
begin
  insert into public.meses (cliente_id, ano_mes, estrategia, origem, redes)
  values (p_cliente, p_ano_mes, p_estrategia, p_origem, p_redes)
  returning id into v_mes;

  insert into public.posts (mes_id, data, rede, tipo, formato, pilar, titulo, legenda,
                            hashtags, horario, roteiro, produto_id, ordem, preco_de, preco_por, ocasiao)
  select v_mes, x.data, x.rede, x.tipo, x.formato, x.pilar, x.titulo, x.legenda,
         coalesce(x.hashtags, '{}'), x.horario, x.roteiro, x.produto_id, x.ordem,
         x.preco_de, x.preco_por, x.ocasiao
  from jsonb_to_recordset(p_posts) as x(
    data date, rede text, tipo text, formato text, pilar text, titulo text, legenda text,
    hashtags text[], horario text, roteiro text, produto_id uuid, ordem int,
    preco_de numeric, preco_por numeric, ocasiao jsonb);

  return v_mes;
end
$$;
revoke execute on function public.criar_mes(uuid, text, text, text, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.criar_mes(uuid, text, text, text, jsonb, text[]) to service_role;

-- trocar_estrategia_mes: idem (mesmo corpo da 20261117000002, com a ocasião).
create or replace function public.trocar_estrategia_mes(
  p_mes uuid, p_estrategia text, p_desde date, p_posts jsonb
) returns int
language plpgsql
set search_path = ''
as $$
declare
  v_base int;
  v_n int;
begin
  update public.meses set estrategia = p_estrategia where id = p_mes;

  delete from public.posts where mes_id = p_mes and data >= p_desde and postado_em is null;

  select coalesce(max(ordem), -1) + 1 into v_base from public.posts where mes_id = p_mes;

  insert into public.posts (mes_id, data, rede, tipo, formato, pilar, titulo, legenda,
                            hashtags, horario, roteiro, produto_id, ordem, preco_de, preco_por, ocasiao)
  select p_mes, x.data, x.rede, x.tipo, x.formato, x.pilar, x.titulo, x.legenda,
         coalesce(x.hashtags, '{}'), x.horario, x.roteiro, x.produto_id, v_base + x.ordem,
         x.preco_de, x.preco_por, x.ocasiao
  from jsonb_to_recordset(p_posts) as x(
    data date, rede text, tipo text, formato text, pilar text, titulo text, legenda text,
    hashtags text[], horario text, roteiro text, produto_id uuid, ordem int,
    preco_de numeric, preco_por numeric, ocasiao jsonb)
  where not exists (
    select 1 from public.posts k
    where k.mes_id = p_mes and k.data = x.data and k.rede = x.rede and k.tipo = x.tipo);

  get diagnostics v_n = row_count;
  return v_n;
end
$$;
revoke execute on function public.trocar_estrategia_mes(uuid, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.trocar_estrategia_mes(uuid, text, date, jsonb) to service_role;
