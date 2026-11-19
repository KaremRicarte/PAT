-- Nome, Instagram e logo do negócio passam a ser definidos pela administração:
-- cada conta do PAT cria conteúdo só para a empresa configurada no painel.
-- O cliente continua escolhendo assinatura, tom, horário, cores, fotos e itens.

-- `pronto` = o cliente já respondeu o questionário do negócio. A linha agora nasce
-- no painel (antes do questionário); as cores começam no padrão e o cliente escolhe as dele.
alter table public.negocios
  add column pronto boolean not null default false,
  alter column cor1 set default '#1F3A5F',
  alter column cor2 set default '#F4F1EA';
update public.negocios set pronto = true;

-- O cliente não cria nem apaga o negócio; a administração cria e altera.
drop policy negocios_inserir on public.negocios;
drop policy negocios_apagar on public.negocios;
create policy negocios_admin_inserir on public.negocios for insert to authenticated
  with check ((select public.is_admin()));
create policy negocios_admin_alterar on public.negocios for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Trava: quem não é admin (nem o servidor) não muda nome, Instagram nem logo.
create function public.negocios_identidade() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.nome is distinct from old.nome or new.insta is distinct from old.insta
     or new.logo_path is distinct from old.logo_path then
    raise exception 'nome, Instagram e logo do negócio são definidos pela administração'
      using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger negocios_identidade before update on public.negocios
  for each row execute function public.negocios_identidade();

-- Arquivos: o logo da administração fica em <cliente>/marca/. O cliente continua gravando
-- as fotos na pasta dele, mas não mexe em <cliente>/marca/ nem no logo antigo (<cliente>/logo.png).
alter policy marcas_inserir on storage.objects
  with check (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
              and coalesce((storage.foldername(name))[2], '') <> 'marca'
              and name <> (select auth.uid())::text || '/logo.png'
              and (select public.cliente_liberado()));
alter policy marcas_alterar on storage.objects
  using (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
         and coalesce((storage.foldername(name))[2], '') <> 'marca'
         and name <> (select auth.uid())::text || '/logo.png'
         and (select public.cliente_liberado()))
  with check (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
              and coalesce((storage.foldername(name))[2], '') <> 'marca'
              and name <> (select auth.uid())::text || '/logo.png'
              and (select public.cliente_liberado()));
alter policy marcas_apagar on storage.objects
  using (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
         and coalesce((storage.foldername(name))[2], '') <> 'marca'
         and name <> (select auth.uid())::text || '/logo.png'
         and (select public.cliente_liberado()));

create policy marcas_admin_inserir on storage.objects for insert to authenticated
  with check (bucket_id = 'marcas' and (select public.is_admin()));
create policy marcas_admin_alterar on storage.objects for update to authenticated
  using (bucket_id = 'marcas' and (select public.is_admin()))
  with check (bucket_id = 'marcas' and (select public.is_admin()));
create policy marcas_admin_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'marcas' and (select public.is_admin()));
