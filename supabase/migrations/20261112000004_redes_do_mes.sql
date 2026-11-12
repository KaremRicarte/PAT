-- PAT v2 · Redes do mês: o cliente escolhe no quiz do mês onde vai postar.
-- Meses antigos ficam com as 4 redes (era o que o gerador fazia).

alter table public.meses
  add column redes text[] not null default '{instagram,facebook,tiktok,whatsapp}'
    check (cardinality(redes) > 0 and redes <@ array['instagram', 'facebook', 'tiktok', 'whatsapp']::text[]);

-- criar_mes passa a gravar as redes do mês. Só a chave de serviço executa (a função gerar-mes).
-- p_redes tem padrão (as 4) para quem ainda chama com 5 argumentos, como a função antiga
-- entre o db push e o deploy.
drop function public.criar_mes(uuid, text, text, text, jsonb);

create function public.criar_mes(
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
                            hashtags, horario, roteiro, produto_id, ordem)
  select v_mes, x.data, x.rede, x.tipo, x.formato, x.pilar, x.titulo, x.legenda,
         coalesce(x.hashtags, '{}'), x.horario, x.roteiro, x.produto_id, x.ordem
  from jsonb_to_recordset(p_posts) as x(
    data date, rede text, tipo text, formato text, pilar text, titulo text, legenda text,
    hashtags text[], horario text, roteiro text, produto_id uuid, ordem int);

  return v_mes;
end
$$;
revoke execute on function public.criar_mes(uuid, text, text, text, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.criar_mes(uuid, text, text, text, jsonb, text[]) to service_role;
