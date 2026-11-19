-- PAT v2 · Dias de post do cliente (plano escolhido no painel do admin; muda a mensalidade):
-- todos os dias, segunda a sábado, dias úteis (segunda a sexta sem feriados nacionais) ou segunda a sexta.
-- Quem já existe começa em segunda a sexta. Só o admin altera (policy clientes_admin_altera).
alter table public.clientes
  add column frequencia text not null default 'seg_sex'
    check (frequencia in ('todos', 'seg_sab', 'uteis', 'seg_sex'));
