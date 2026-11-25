-- Detalhes do pacote de viagem (ramo Turismo) e o WhatsApp da empresa.
-- pacote: { ativo, hotel, ida, volta, transporte, transfer, refeicoes, preco_por, parcelas, taxas, pix }; validado no app
-- e em _shared/modelos/pacote.ts (lerPacote). whatsapp: só dígitos, DDD + número.
alter table public.produtos add column pacote jsonb check (pacote is null or jsonb_typeof(pacote) = 'object');
alter table public.negocios add column whatsapp text check (whatsapp is null or whatsapp ~ '^\d{10,11}$');
