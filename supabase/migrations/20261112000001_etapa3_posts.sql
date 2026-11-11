-- PAT v2 · Etapa 3: situação do post (aprovar/reprovar), foto, "postado" e inscrições de push.

alter table public.posts drop constraint posts_estado_check;
alter table public.posts add constraint posts_estado_check
  check (estado in ('gerado', 'aprovado', 'editado', 'reprovado'));

alter table public.posts
  add column foto_path text,
  add column sem_foto boolean not null default false,
  add column postado_em timestamptz;

-- O cliente só mexe nestas colunas (legenda, título etc. continuam só leitura).
grant update (estado, foto_path, sem_foto, postado_em) on public.posts to authenticated;

create policy posts_alterar on public.posts for update to authenticated
  using (
    (select public.cliente_ativo())
    and exists (select 1 from public.meses m where m.id = mes_id and m.cliente_id = (select auth.uid()))
  )
  with check (
    (select public.cliente_ativo())
    and exists (select 1 from public.meses m where m.id = mes_id and m.cliente_id = (select auth.uid()))
  );

-- Regras que o grant de coluna não cobre; só valem para o cliente (a chave de serviço passa direto).
create function public.posts_cliente_regras() returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    if new.estado is distinct from old.estado and new.estado not in ('gerado', 'aprovado', 'reprovado') then
      raise exception 'Situação não permitida.' using errcode = '42501';
    end if;
    if new.foto_path is not null and new.foto_path not like auth.uid()::text || '/%' then
      raise exception 'Foto fora da sua pasta.' using errcode = '42501';
    end if;
    -- a hora do "postado" é sempre a do servidor
    new.postado_em := case
      when new.postado_em is null then null
      when old.postado_em is not null then old.postado_em
      else now()
    end;
  end if;
  return new;
end
$$;

create trigger posts_cliente_regras before update on public.posts
  for each row execute function public.posts_cliente_regras();

create table public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz default now()
);

alter table public.push_inscricoes enable row level security;
revoke all on public.push_inscricoes from anon, authenticated;
grant select, insert, delete on public.push_inscricoes to authenticated;

create policy push_ler on public.push_inscricoes for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.is_admin()));
create policy push_inserir on public.push_inscricoes for insert to authenticated
  with check (cliente_id = (select auth.uid()) and (select public.cliente_ativo()));
create policy push_apagar on public.push_inscricoes for delete to authenticated
  using (cliente_id = (select auth.uid()));

create extension if not exists pg_cron;
create extension if not exists pg_net;
