import { vi } from 'vitest'

vi.mock('../../app/src/comum.js', () => ({ aviso: vi.fn() }))
const { aplicarAcao } = await import('../../app/src/cliente/acoesPost.js')
const { aviso } = await import('../../app/src/comum.js')

// supabase falso: from().update().eq().select().single() resolve o que `resposta` devolver.
function falso(resposta) {
  const chamadas = []
  const supabase = {
    from: (tabela) => ({
      update: (mudanca) => ({
        eq: (col, id) => ({
          select: () => ({
            single: () => { chamadas.push({ tabela, mudanca, col, id }); return resposta(mudanca) },
          }),
        }),
      }),
    }),
  }
  return { supabase, chamadas }
}

test('falha restaura o estado e devolve false', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const post = { id: 'p1', estado: 'gerado', postado_em: null }
  const vistos = []
  const { supabase } = falso(async () => ({ data: null, error: { message: 'offline' } }))
  const ok = await aplicarAcao({ supabase, post, acao: 'aprovar', aoMudar: () => vistos.push(post.estado) })
  expect(ok).toBe(false)
  expect(post).toEqual({ id: 'p1', estado: 'gerado', postado_em: null })
  expect(vistos).toEqual(['aprovado', 'gerado']) // otimista e depois restaurado
  expect(aviso).toHaveBeenCalledWith('Sem conexão. Tente de novo.')
})

test('segunda chamada durante a primeira é ignorada', async () => {
  const post = { id: 'p2', estado: 'gerado', postado_em: null }
  let liberar
  const { supabase, chamadas } = falso((m) => new Promise((ok) => { liberar = () => ok({ data: { ...post, ...m }, error: null }) }))
  const primeira = aplicarAcao({ supabase, post, acao: 'aprovar' })
  expect(await aplicarAcao({ supabase, post, acao: 'descartar' })).toBe(false)
  liberar()
  expect(await primeira).toBe(true)
  expect(chamadas).toHaveLength(1)
  expect(post.estado).toBe('aprovado')
  // terminada a primeira, uma nova ação já é aceita
  const { supabase: s2 } = falso(async (m) => ({ data: { ...post, ...m }, error: null }))
  expect(await aplicarAcao({ supabase: s2, post, acao: 'desaprovar' })).toBe(true)
})

test('sucesso usa o que o banco devolveu', async () => {
  const post = { id: 'p3', estado: 'aprovado', postado_em: null }
  const { supabase, chamadas } = falso(async () => ({ data: { id: 'p3', estado: 'aprovado', postado_em: '2026-11-04T15:00:00+00:00' }, error: null }))
  const ok = await aplicarAcao({ supabase, post, acao: 'postei' })
  expect(ok).toBe(true)
  expect(chamadas[0]).toMatchObject({ tabela: 'posts', col: 'id', id: 'p3', mudanca: { estado: 'aprovado' } })
  expect(post.postado_em).toBe('2026-11-04T15:00:00+00:00')
})
