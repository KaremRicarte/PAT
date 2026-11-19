-- PAT v2 · A data da promoção vale com ou sem preço (sem preço, os posts da data saem sem valor).
-- Tira a regra da 20261119000001 que exigia preço promocional para marcar a data.
alter table public.produtos drop constraint if exists produtos_check1;
