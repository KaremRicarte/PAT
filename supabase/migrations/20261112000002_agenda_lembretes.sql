-- PAT v2 · Etapa 3: agenda dos lembretes (pg_cron + pg_net chamam a função lembrete).
--
-- A URL da função e o segredo ficam no Vault, NUNCA neste arquivo. Eles são inseridos à mão
-- (SQL editor ou Management API), uma vez por projeto:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/lembrete', 'lembrete_url');
--   select vault.create_secret('<o mesmo valor do segredo LEMBRETE_SECRET>', 'lembrete_secret');
-- Enquanto não existirem, as chamadas agendadas falham sem efeito.
--
-- O pg_cron roda em UTC; São Paulo é UTC-3 o ano todo: 11h UTC = 8h, 23h UTC = 20h.

select cron.schedule('lembrete-manha', '0 11 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-lembrete-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_secret')
    ),
    body := '{"turno":"manha"}'::jsonb
  )
$$);

select cron.schedule('lembrete-noite', '0 23 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-lembrete-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_secret')
    ),
    body := '{"turno":"noite"}'::jsonb
  )
$$);
