-- PAT v2 · Etapa 3: ajustes. Inscrição de push por RPC e regras do gatilho dos posts.

-- 1. Inscrição de push.
-- O cliente não tem UPDATE em push_inscricoes e o endpoint é unique: um aparelho que já foi de
-- outra conta (ou uma reinscrição) precisa trocar de dono. A RPC grava ou reatribui o endpoint
-- a quem chamou, sempre com o id do token (auth.uid()), nunca um id vindo do app.
create function public.inscrever_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.cliente_ativo() then
    raise exception 'Acesso não permitido.' using errcode = '42501';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Inscrição inválida.' using errcode = '22023';
  end if;
  insert into public.push_inscricoes (cliente_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set cliente_id = excluded.cliente_id, p256dh = excluded.p256dh, auth = excluded.auth;
end
$$;
revoke all on function public.inscrever_push(text, text, text) from public, anon;
grant execute on function public.inscrever_push(text, text, text) to authenticated;

-- 2. Gatilho dos posts (o mesmo da 20261112000001), agora:
--   a. com search_path vazio e nomes qualificados;
--   b. conferindo foto_path só quando ele muda (outras colunas não tropeçam numa foto antiga);
--   c. aceitando sem_foto = true só nos ramos só de texto (textOnly em
--      supabase/functions/_shared/modelos/ramos/). Um ramo textOnly novo precisa entrar nesta lista.
create or replace function public.posts_cliente_regras() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' then
    if new.estado is distinct from old.estado and new.estado not in ('gerado', 'aprovado', 'reprovado') then
      raise exception 'Situação não permitida.' using errcode = '42501';
    end if;
    if new.foto_path is distinct from old.foto_path
      and new.foto_path is not null and new.foto_path not like auth.uid()::text || '/%' then
      raise exception 'Foto fora da sua pasta.' using errcode = '42501';
    end if;
    if new.sem_foto and new.sem_foto is distinct from old.sem_foto
      and not exists (
        select 1 from public.clientes c
        where c.id = auth.uid() and c.ramo in ('advocacia', 'psicologia')
      ) then
      raise exception 'Sem foto só vale nos ramos só de texto.' using errcode = '42501';
    end if;
    -- a hora do "postado" é sempre a do servidor
    new.postado_em := case
      when new.postado_em is null then null
      when old.postado_em is not null then old.postado_em
      else pg_catalog.now()
    end;
  end if;
  return new;
end
$$;
