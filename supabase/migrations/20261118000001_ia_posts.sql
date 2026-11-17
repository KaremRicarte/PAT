-- PAT v2 · Etapa 4A: posts melhorados por IA (fila), fotos, uso e banco de imagens.

-- 1. Colunas de posts. O cliente não altera: elas não entram no grant update de posts.
alter table public.posts
  add column origem text not null default 'modelo' check (origem in ('modelo', 'ia')),
  add column ia_estado text not null default 'fila'
    check (ia_estado in ('fila', 'trabalhando', 'pronto', 'pulado', 'desistiu')),
  add column ia_em timestamptz;

-- posts que já existem: só os futuros, ainda não aprovados nem postados, entram na fila
update public.posts set ia_estado = 'pulado'
where not (
  data >= (now() at time zone 'America/Sao_Paulo')::date
  and estado in ('gerado', 'reprovado')
  and postado_em is null
);

create index posts_ia_fila_idx on public.posts (data, ordem) where ia_estado in ('fila', 'trabalhando');

-- post que fica aprovado ou postado sai da fila
create function public.posts_ia_sai_da_fila() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ia_estado in ('fila', 'trabalhando') and (new.estado = 'aprovado' or new.postado_em is not null) then
    new.ia_estado := 'pulado';
  end if;
  return new;
end
$$;
create trigger posts_ia_sai_da_fila before insert or update on public.posts
  for each row execute function public.posts_ia_sai_da_fila();

-- 2. Pega posts da fila (só a chave de serviço executa).
create function public.pegar_posts_para_ia(p_limite int) returns setof public.posts
language sql
set search_path = ''
as $$
  with pegos as (
    select id from public.posts
    where data >= (now() at time zone 'America/Sao_Paulo')::date
      and estado in ('gerado', 'reprovado')
      and postado_em is null
      and (ia_estado = 'fila'
           or (ia_estado = 'trabalhando' and ia_em < now() - interval '5 minutes'))
    order by data, ordem
    limit greatest(coalesce(p_limite, 0), 0)
    for update skip locked
  )
  update public.posts p set ia_estado = 'trabalhando', ia_em = now()
  from pegos where p.id = pegos.id
  returning p.*
$$;
revoke execute on function public.pegar_posts_para_ia(int) from public, anon, authenticated;
grant execute on function public.pegar_posts_para_ia(int) to service_role;

-- 3. Minhas fotos do negócio
alter table public.negocios
  add column fotos text[] not null default '{}' check (cardinality(fotos) <= 30);

-- 4. Fotos analisadas pela IA
create table public.fotos_ia (
  path text primary key,
  cliente_id uuid references public.clientes on delete cascade,
  origem text not null check (origem in ('cliente', 'banco', 'pexels', 'pixabay')),
  ramo text,
  externo_id text,
  autor text,
  descricao text,
  serve boolean,
  motivo text,
  criado_em timestamptz not null default now(),
  unique (origem, externo_id)
);
create index fotos_ia_cliente_idx on public.fotos_ia (cliente_id);
alter table public.fotos_ia enable row level security;
revoke all on public.fotos_ia from anon, authenticated;
grant select, delete on public.fotos_ia to authenticated;
create policy fotos_ia_ler on public.fotos_ia for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.is_admin()));
create policy fotos_ia_apagar on public.fotos_ia for delete to authenticated
  using (cliente_id = (select auth.uid()) or (select public.is_admin()));

-- 5. Fotos do banco já usadas por cliente (janela de 90 dias). Só serviço.
create table public.fotos_usadas (
  cliente_id uuid not null references public.clientes on delete cascade,
  path text not null,
  usado_em timestamptz not null default now()
);
create index fotos_usadas_idx on public.fotos_usadas (cliente_id, usado_em desc);
alter table public.fotos_usadas enable row level security;
revoke all on public.fotos_usadas from anon, authenticated;

-- 6. Uso de IA (custo)
create table public.uso_ia (
  id bigserial primary key,
  cliente_id uuid,
  tipo text not null check (tipo in ('foto', 'post', 'troca', 'imagem')),
  tokens_entrada int,
  tokens_saida int,
  custo_usd numeric(10, 5),
  criado_em timestamptz not null default now()
);
create index uso_ia_cliente_idx on public.uso_ia (cliente_id, criado_em);
alter table public.uso_ia enable row level security;
revoke all on public.uso_ia from anon, authenticated;
grant select on public.uso_ia to authenticated;
create policy uso_ia_ler on public.uso_ia for select to authenticated
  using ((select public.is_admin()));

-- quantas chamadas de IA o cliente fez no mês do calendário (São Paulo)
create function public.uso_ia_no_mes(p_cliente uuid) returns int
language sql stable
set search_path = ''
as $$
  select count(*)::int from public.uso_ia
  where cliente_id = p_cliente
    and (criado_em at time zone 'America/Sao_Paulo') >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
$$;
revoke execute on function public.uso_ia_no_mes(uuid) from public, anon, authenticated;
grant execute on function public.uso_ia_no_mes(uuid) to service_role;

-- 7. Bucket do banco de imagens: só o admin mexe.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banco', 'banco', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy banco_ler on storage.objects for select to authenticated
  using (bucket_id = 'banco' and (select public.is_admin()));
create policy banco_inserir on storage.objects for insert to authenticated
  with check (bucket_id = 'banco' and (select public.is_admin()));
create policy banco_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'banco' and (select public.is_admin()));

-- 8. Agenda: a função melhorar-posts roda a cada minuto (mesmo padrão dos lembretes).
-- No Vault, uma vez por projeto:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/melhorar-posts', 'melhorar_posts_url');
--   select vault.create_secret('<segredo>', 'melhorar_posts_secret');
-- Enquanto não existirem (ou a função não estiver publicada), a chamada falha sem efeito.
select cron.schedule('melhorar-posts', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'melhorar_posts_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-melhorar-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'melhorar_posts_secret')
    ),
    body := '{}'::jsonb
  )
$$);
