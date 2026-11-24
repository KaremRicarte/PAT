-- PAT · Caixinha "Ocultar preço" no item: o preço fica salvo, mas os posts saem sem valor (sem selo na arte e sem
-- parágrafo de preço na legenda). As funções que geram posts tratam o item marcado como item sem preço.
alter table public.produtos add column ocultar_preco boolean not null default false;
