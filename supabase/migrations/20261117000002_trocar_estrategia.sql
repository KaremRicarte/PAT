-- Troca a estratégia de um mês já gerado: refaz os posts ainda não postados de p_desde em diante.
-- Numa transação só: atualiza a estratégia, apaga os não postados de p_desde em diante e insere os novos,
-- menos os que repetiriam (data, rede, tipo) de um post que ficou (postado). Devolve quantos inseriu.
-- A ordem dos novos começa depois da maior ordem dos que ficaram; como já vêm ordenados por data, mantêm a sequência.
-- Só a chave de serviço executa (a função trocar-estrategia).
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
                            hashtags, horario, roteiro, produto_id, ordem, preco_de, preco_por)
  select p_mes, x.data, x.rede, x.tipo, x.formato, x.pilar, x.titulo, x.legenda,
         coalesce(x.hashtags, '{}'), x.horario, x.roteiro, x.produto_id, v_base + x.ordem,
         x.preco_de, x.preco_por
  from jsonb_to_recordset(p_posts) as x(
    data date, rede text, tipo text, formato text, pilar text, titulo text, legenda text,
    hashtags text[], horario text, roteiro text, produto_id uuid, ordem int,
    preco_de numeric, preco_por numeric)
  where not exists (
    select 1 from public.posts k
    where k.mes_id = p_mes and k.data = x.data and k.rede = x.rede and k.tipo = x.tipo);

  get diagnostics v_n = row_count;
  return v_n;
end
$$;
revoke execute on function public.trocar_estrategia_mes(uuid, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.trocar_estrategia_mes(uuid, text, date, jsonb) to service_role;
