-- PAT v2 · Etapa 1: clientes, eventos de acesso e regras de segurança (RLS)

create table public.clientes (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text unique not null,
  telefone text not null check (telefone ~ '^[0-9]{10,15}$'),
  idioma text not null default 'pt' check (idioma in ('pt', 'es')),
  situacao text not null default 'ativo' check (situacao in ('ativo', 'bloqueado')),
  senha_provisoria boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.eventos (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  tipo text not null check (tipo in ('acesso')),
  criado_em timestamptz not null default now()
);
create index eventos_cliente_idx on public.eventos (cliente_id, criado_em desc);

-- Papel de administradora: fica em app_metadata, que só a chave de serviço grava.
create function public.is_admin() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

-- O cliente só consegue mexer na própria senha_provisoria, e só para false.
create function public.marcar_senha_trocada() returns void
language sql security definer
set search_path = ''
as $$
  update public.clientes set senha_provisoria = false where id = auth.uid()
$$;
revoke execute on function public.marcar_senha_trocada() from public, anon;
grant execute on function public.marcar_senha_trocada() to authenticated;

alter table public.clientes enable row level security;
alter table public.eventos enable row level security;

-- Permissões de tabela: anon não acessa nada; as políticas abaixo filtram o resto.
revoke all on public.clientes, public.eventos from anon, authenticated;
grant select, update on public.clientes to authenticated;
grant select, insert on public.eventos to authenticated;

create policy clientes_ler on public.clientes
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy clientes_admin_altera on public.clientes
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy eventos_registrar on public.eventos
  for insert to authenticated
  with check (cliente_id = (select auth.uid()));

create policy eventos_admin_le on public.eventos
  for select to authenticated
  using ((select public.is_admin()));
