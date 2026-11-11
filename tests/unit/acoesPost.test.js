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

test('ação desconhecida não deixa o post preso', async () => {
  const post = { id: 'p4', estado: 'gerado', postado_em: null }
  const { supabase } = falso(async (m) => ({ data: { ...post, ...m }, error: null }))
  await expect(aplicarAcao({ supabase, post, acao: 'voar' })).rejects.toThrow('ação desconhecida')
  expect(await aplicarAcao({ supabase, post, acao: 'aprovar' })).toBe(true)
})

// ---------- Gerar outro ----------
const { gerarOutro, nomeDoArquivo, trocasDoMes, LIMITE_TROCAS } = await import('../../app/src/cliente/acoesPost.js')

// supabase falso: functions.invoke resolve o que `resposta` devolver.
function funcoes(resposta) {
  const chamadas = []
  return { chamadas, supabase: { functions: { invoke: (nome, opcoes) => { chamadas.push({ nome, opcoes }); return resposta() } } } }
}
// Erro como o do supabase-js: context é a Response da função.
const erroHttp = (status, corpo) => ({ name: 'FunctionsHttpError', context: { status, json: async () => corpo } })

test('gerarOutro devolve o post novo', async () => {
  const novo = { id: 'p5', legenda: 'outra', trocas: 1 }
  const { supabase, chamadas } = funcoes(async () => ({ data: { post: novo }, error: null }))
  expect(await gerarOutro({ supabase, post: { id: 'p5' } })).toEqual({ post: novo })
  expect(chamadas).toEqual([{ nome: 'trocar-post', opcoes: { body: { post_id: 'p5' } } }])
})

test('gerarOutro mostra a mensagem do limite (429) e do texto repetido (422)', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const limite = 'Você já usou as 10 trocas deste mês.'
  const { supabase } = funcoes(async () => ({ data: null, error: erroHttp(429, { erro: limite }) }))
  expect(await gerarOutro({ supabase, post: { id: 'p6' } })).toEqual({ erro: limite })
  const repetido = 'Não encontrei outro texto diferente para este post. Você pode usar "Só descartar".'
  const { supabase: s2 } = funcoes(async () => ({ data: null, error: erroHttp(422, { erro: repetido }) }))
  expect(await gerarOutro({ supabase: s2, post: { id: 'p6' } })).toEqual({ erro: repetido })
})

test('gerarOutro sem resposta da função avisa sem conexão', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { supabase } = funcoes(async () => ({ data: null, error: { name: 'FunctionsFetchError', context: new TypeError('Failed to fetch') } }))
  expect(await gerarOutro({ supabase, post: { id: 'p7' } })).toEqual({ erro: 'Sem conexão. Tente de novo.' })
  const { supabase: s2 } = funcoes(async () => { throw new TypeError('Failed to fetch') })
  expect(await gerarOutro({ supabase: s2, post: { id: 'p7' } })).toEqual({ erro: 'Sem conexão. Tente de novo.' })
})

test('gerarOutro não roda junto com outra ação do mesmo post', async () => {
  const post = { id: 'p8', estado: 'gerado', postado_em: null }
  let liberar
  const { supabase } = falso((m) => new Promise((ok) => { liberar = () => ok({ data: { ...post, ...m }, error: null }) }))
  const aprovando = aplicarAcao({ supabase, post, acao: 'aprovar' })
  const { supabase: s2, chamadas } = funcoes(async () => ({ data: { post: {} }, error: null }))
  expect(await gerarOutro({ supabase: s2, post })).toEqual({ erro: 'Espere a última ação terminar.' })
  expect(chamadas).toHaveLength(0)
  liberar()
  await aprovando
})

test('trocas usadas no mês', () => {
  expect(LIMITE_TROCAS).toBe(10)
  expect(trocasDoMes([{ trocas: 3 }, { trocas: 0 }, {}, { trocas: 7 }])).toBe(10)
})

// ---------- Nome do arquivo ----------
test('nomeDoArquivo com e sem página', () => {
  const carrossel = { data: '2026-11-04', rede: 'instagram', tipo: 'feed', formato: 'carrossel' }
  expect(nomeDoArquivo(carrossel, 2, 'png')).toBe('2026-11-04_instagram_carrossel_2.png')
  expect(nomeDoArquivo({ data: '2026-11-05', rede: 'facebook', tipo: 'feed', formato: 'arte' }, null, 'png'))
    .toBe('2026-11-05_facebook_arte.png')
  expect(nomeDoArquivo({ data: '2026-11-06', rede: 'tiktok', tipo: 'video', formato: 'montagem' }, undefined, 'mp4'))
    .toBe('2026-11-06_tiktok_montagem.mp4')
  expect(nomeDoArquivo({ data: '2026-11-07', rede: 'whatsapp', tipo: 'status', formato: 'status' }, null, 'png'))
    .toBe('2026-11-07_whatsapp_status.png')
})
