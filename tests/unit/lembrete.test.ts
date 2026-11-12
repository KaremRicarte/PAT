import { quemAvisar, textoDoLembrete } from '../../supabase/functions/_shared/lembrete.ts'

const linha = (cliente_id: string, rede: string, extra: Record<string, unknown> = {}) =>
  ({ cliente_id, situacao: 'ativo', rede, estado: 'gerado', postado_em: null, ...extra })

test("quemAvisar('manha') ignora o bloqueado e o reprovado", () => {
  const r = quemAvisar('manha', [
    linha('a', 'whatsapp'),
    linha('a', 'instagram', { estado: 'aprovado' }),
    linha('a', 'facebook', { estado: 'reprovado' }),
    linha('a', 'instagram', { postado_em: '2026-11-12T12:00:00Z' }),
    linha('b', 'instagram', { situacao: 'bloqueado' }),
  ])
  expect([...r.keys()]).toEqual(['a'])
  expect(r.get('a')).toEqual({ total: 3, redes: ['instagram', 'whatsapp'] })
})

test("quemAvisar('noite') ignora quem postou tudo", () => {
  const r = quemAvisar('noite', [
    linha('a', 'instagram', { postado_em: '2026-11-12T12:00:00Z' }),
    linha('a', 'tiktok', { estado: 'reprovado' }),
    linha('b', 'facebook', { postado_em: '2026-11-12T12:00:00Z' }),
    linha('b', 'tiktok'),
  ])
  expect([...r.keys()]).toEqual(['b'])
  expect(r.get('b')).toEqual({ total: 1, redes: ['tiktok'] })
})

test('textoDoLembrete da manhã: plural e redes por extenso', () => {
  expect(textoDoLembrete('manha', { total: 2, redes: ['instagram', 'whatsapp'] })).toEqual({
    titulo: 'PAT', corpo: 'Bom dia! Hoje você tem 2 posts: Instagram e Status do WhatsApp 📲',
  })
  expect(textoDoLembrete('manha', { total: 3, redes: ['instagram', 'facebook', 'tiktok'] }).corpo)
    .toBe('Bom dia! Hoje você tem 3 posts: Instagram, Facebook e TikTok 📲')
  expect(textoDoLembrete('manha', { total: 1, redes: ['facebook'] }).corpo)
    .toBe('Bom dia! Hoje você tem 1 post: Facebook 📲')
})

test('textoDoLembrete da noite: singular', () => {
  expect(textoDoLembrete('noite', { total: 1, redes: ['instagram'] })).toEqual({
    titulo: 'PAT', corpo: 'Ainda falta postar 1 post de hoje. Leva 1 minutinho 😉',
  })
  expect(textoDoLembrete('noite', { total: 2, redes: ['instagram'] }).corpo)
    .toBe('Ainda falta postar 2 posts de hoje. Leva 1 minutinho 😉')
})
