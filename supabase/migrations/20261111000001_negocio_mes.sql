-- PAT v2 · Etapa 2: ramo do cliente, negócio, itens, meses e posts, bucket de marcas.

-- Ramo: escolhido pela administradora. O banco só confere o formato; a lista
-- válida fica no código (supabase/functions/_shared/modelos/ramos/), para que
-- incluir um ramo novo não precise de migração.
alter table public.clientes
  add column ramo text check (ramo ~ '^[a-z][a-z0-9_]{1,29}$');

-- Cliente ativo de verdade (lido do banco, nunca do token).
create function public.cliente_ativo() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.clientes where id = auth.uid() and situacao = 'ativo')
$$;
revoke execute on function public.cliente_ativo() from public, anon;
grant execute on function public.cliente_ativo() to authenticated;

create table public.negocios (
  cliente_id uuid primary key references public.clientes (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 80),
  insta text check (insta ~ '^@?[A-Za-z0-9._]{1,30}$'),
  assinatura text not null default 'ambos' check (assinatura in ('logo', 'insta', 'ambos')),
  tom text not null default 'proximo' check (tom in ('proximo', 'tecnico', 'promo')),
  horario text not null default '19:00' check (horario in ('07:00', '12:00', '19:00')),
  cor1 text not null check (cor1 ~ '^#[0-9A-Fa-f]{6}$'),
  cor2 text not null check (cor2 ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path text,
  atualizado_em timestamptz not null default now()
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.negocios (cliente_id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 80),
  descricao text check (char_length(descricao) <= 300),
  preco numeric(10, 2) check (preco > 0),
  foto_path text,
  ordem int not null default 0
);
create index produtos_cliente_idx on public.produtos (cliente_id, ordem);

create table public.meses (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  ano_mes text not null check (ano_mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  estrategia text not null check (estrategia in ('vender', 'crescer', 'credibilidade', 'tempo')),
  origem text not null check (origem in ('ia', 'modelo')),
  gerado_em timestamptz not null default now(),
  unique (cliente_id, ano_mes)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  mes_id uuid not null references public.meses (id) on delete cascade,
  data date not null,
  rede text not null check (rede in ('instagram', 'facebook', 'tiktok', 'whatsapp')),
  tipo text not null check (tipo in ('feed', 'stories', 'video', 'status', 'lista')),
  formato text not null check (formato in ('arte', 'carrossel', 'montagem', 'gravar', 'texto')),
  pilar text not null check (pilar in ('demo', 'aprox', 'need')),
  titulo text not null,
  legenda text not null,
  hashtags text[] not null default '{}',
  horario text not null,
  roteiro text,
  produto_id uuid references public.produtos (id) on delete set null,
  estado text not null default 'gerado' check (estado in ('gerado', 'aprovado', 'editado')),
  trocas int not null default 0,
  ordem int not null
);
create index posts_mes_idx on public.posts (mes_id, data);

-- Grava o mês e os posts numa transação só. Só a chave de serviço executa
-- (a função gerar-mes); mês repetido levanta 23505 pelo unique.
create function public.criar_mes(
  p_cliente uuid, p_ano_mes text, p_estrategia text, p_origem text, p_posts jsonb
) returns uuid
language plpgsql
set search_path = ''
as $$
declare v_mes uuid;
begin
  insert into public.meses (cliente_id, ano_mes, estrategia, origem)
  values (p_cliente, p_ano_mes, p_estrategia, p_origem)
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
revoke execute on function public.criar_mes(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.criar_mes(uuid, text, text, text, jsonb) to service_role;

alter table public.negocios enable row level security;
alter table public.produtos enable row level security;
alter table public.meses enable row level security;
alter table public.posts enable row level security;

revoke all on public.negocios, public.produtos, public.meses, public.posts from anon, authenticated;
grant select, insert, update, delete on public.negocios, public.produtos to authenticated;
grant select on public.meses, public.posts to authenticated;

-- negocios e produtos: o cliente lê o que é dele e só grava se estiver ativo; o admin lê tudo.
create policy negocios_ler on public.negocios for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.is_admin()));
create policy negocios_inserir on public.negocios for insert to authenticated
  with check (cliente_id = (select auth.uid()) and (select public.cliente_ativo()));
create policy negocios_alterar on public.negocios for update to authenticated
  using (cliente_id = (select auth.uid()) and (select public.cliente_ativo()))
  with check (cliente_id = (select auth.uid()) and (select public.cliente_ativo()));
create policy negocios_apagar on public.negocios for delete to authenticated
  using (cliente_id = (select auth.uid()) and (select public.cliente_ativo()));

create policy produtos_ler on public.produtos for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.is_admin()));
create policy produtos_inserir on public.produtos for insert to authenticated
  with check (cliente_id = (select auth.uid()) and (select public.cliente_ativo()));
create policy produtos_alterar on public.produtos for update to authenticated
  using (cliente_id = (select auth.uid()) and (select public.cliente_ativo()))
  with check (cliente_id = (select auth.uid()) and (select public.cliente_ativo()));
create policy produtos_apagar on public.produtos for delete to authenticated
  using (cliente_id = (select auth.uid()) and (select public.cliente_ativo()));

-- meses e posts: só leitura para o dono e para o admin (quem grava é a função).
create policy meses_ler on public.meses for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.is_admin()));
create policy posts_ler on public.posts for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.meses m where m.id = mes_id and m.cliente_id = (select auth.uid()))
  );

-- Pendência (b) da Etapa 1: cliente bloqueado não registra eventos.
drop policy eventos_registrar on public.eventos;
create policy eventos_registrar on public.eventos for insert to authenticated
  with check (cliente_id = (select auth.uid()) and (select public.cliente_ativo()));

-- Bucket privado para logo e fotos; cada cliente só mexe na pasta com o próprio id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marcas', 'marcas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy marcas_ler on storage.objects for select to authenticated
  using (bucket_id = 'marcas' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
create policy marcas_inserir on storage.objects for insert to authenticated
  with check (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.cliente_ativo()));
create policy marcas_alterar on storage.objects for update to authenticated
  using (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select public.cliente_ativo()))
  with check (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.cliente_ativo()));
create policy marcas_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select public.cliente_ativo()));
