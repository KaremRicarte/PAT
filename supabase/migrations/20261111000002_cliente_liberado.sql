-- PAT v2 · Etapa 2 (revisão final): só grava negócio, itens e arquivos quem está ativo
-- E já trocou a senha provisória. Os eventos continuam usando cliente_ativo().

create function public.cliente_liberado() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clientes
    where id = auth.uid() and situacao = 'ativo' and not senha_provisoria
  )
$$;
revoke execute on function public.cliente_liberado() from public, anon;
grant execute on function public.cliente_liberado() to authenticated;

alter policy negocios_inserir on public.negocios
  with check (cliente_id = (select auth.uid()) and (select public.cliente_liberado()));
alter policy negocios_alterar on public.negocios
  using (cliente_id = (select auth.uid()) and (select public.cliente_liberado()))
  with check (cliente_id = (select auth.uid()) and (select public.cliente_liberado()));
alter policy negocios_apagar on public.negocios
  using (cliente_id = (select auth.uid()) and (select public.cliente_liberado()));

alter policy produtos_inserir on public.produtos
  with check (cliente_id = (select auth.uid()) and (select public.cliente_liberado()));
alter policy produtos_alterar on public.produtos
  using (cliente_id = (select auth.uid()) and (select public.cliente_liberado()))
  with check (cliente_id = (select auth.uid()) and (select public.cliente_liberado()));
alter policy produtos_apagar on public.produtos
  using (cliente_id = (select auth.uid()) and (select public.cliente_liberado()));

alter policy marcas_inserir on storage.objects
  with check (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.cliente_liberado()));
alter policy marcas_alterar on storage.objects
  using (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select public.cliente_liberado()))
  with check (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.cliente_liberado()));
alter policy marcas_apagar on storage.objects
  using (bucket_id = 'marcas' and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select public.cliente_liberado()));
