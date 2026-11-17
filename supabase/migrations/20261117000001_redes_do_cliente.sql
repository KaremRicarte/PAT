-- PAT v2 · Redes do cliente: quem define onde o cliente posta é a administradora (no painel).
-- Só ela altera: a política clientes_admin_altera já é a única de update em clientes.
alter table public.clientes
  add column redes text[] not null default '{instagram,facebook,tiktok,whatsapp}'
    check (cardinality(redes) > 0 and redes <@ array['instagram', 'facebook', 'tiktok', 'whatsapp']::text[]);

-- Clientes existentes herdam as redes do mês mais recente (se tiverem algum mês).
update public.clientes c set redes = m.redes
from (
  select distinct on (cliente_id) cliente_id, redes
  from public.meses
  order by cliente_id, ano_mes desc
) m
where m.cliente_id = c.id;
