-- Telefones com DDI de 11 dígitos (Chile, Peru, Uruguai...) passam a ser aceitos.
-- Fica igual à validação da função admin-clientes: de 11 a 15 dígitos.
alter table public.clientes drop constraint clientes_telefone_check;
alter table public.clientes add constraint clientes_telefone_check check (telefone ~ '^[0-9]{11,15}$');
