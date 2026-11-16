-- PAT v2 · Preço promocional, várias fotos por produto e preço guardado no post.

-- Produto: preço promocional (só vale com preço normal, e nunca acima dele) e até 6 fotos.
alter table public.produtos
  add column preco_promo numeric(10, 2)
    check (preco_promo is null or (preco_promo > 0 and preco is not null and preco_promo <= preco)),
  add column fotos text[] not null default '{}'
    check (cardinality(fotos) <= 6);

-- A foto única que já existia vira a primeira da lista (foto_path continua como está).
update public.produtos set fotos = array[foto_path] where foto_path is not null and fotos = '{}';

-- Post: o preço "de" e "por" no momento da geração (se mudar o produto depois, o post não muda).
alter table public.posts
  add column preco_de numeric(10, 2),
  add column preco_por numeric(10, 2);

-- criar_mes passa a gravar preco_de e preco_por de cada post. Mesma assinatura de antes;
-- só a chave de serviço executa (a função gerar-mes).
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
                            hashtags, horario, roteiro, produto_id, ordem, preco_de, preco_por)
  select v_mes, x.data, x.rede, x.tipo, x.formato, x.pilar, x.titulo, x.legenda,
         coalesce(x.hashtags, '{}'), x.horario, x.roteiro, x.produto_id, x.ordem,
         x.preco_de, x.preco_por
  from jsonb_to_recordset(p_posts) as x(
    data date, rede text, tipo text, formato text, pilar text, titulo text, legenda text,
    hashtags text[], horario text, roteiro text, produto_id uuid, ordem int,
    preco_de numeric, preco_por numeric);

  return v_mes;
end
$$;
revoke execute on function public.criar_mes(uuid, text, text, text, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.criar_mes(uuid, text, text, text, jsonb, text[]) to service_role;
