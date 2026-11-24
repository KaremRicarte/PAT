-- PAT · Até 12 fotos por item (antes eram 6), para variar as imagens dos posts ao longo do ano.
alter table public.produtos drop constraint produtos_fotos_check;
alter table public.produtos add constraint produtos_fotos_check check (cardinality(fotos) <= 12);
