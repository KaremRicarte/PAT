-- Turismo: o preço passou a morar em "Detalhes do pacote" (sem o pacote marcado, o item não tem preço nos posts).
-- Para nada sumir: os pacotes que já têm preço, ou que estavam com "Ocultar preço" (agora "Entrar em contato
-- para as condições"), ficam com os detalhes marcados, mantendo o que já foi preenchido.
update public.produtos p
   set pacote = coalesce(p.pacote, '{}'::jsonb) || '{"ativo": true}'::jsonb
  from public.clientes c
 where c.id = p.cliente_id
   and c.ramo = 'turismo'
   and (p.preco is not null or p.ocultar_preco)
   and coalesce((p.pacote ->> 'ativo')::boolean, false) = false;
