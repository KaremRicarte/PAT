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

// ---------- Salvar no aparelho ----------
const { modoDeSalvar } = await import('../../app/src/cliente/acoesPost.js')
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
}

test('iPhone com compartilhamento de arquivos: compartilhar (vai para Fotos)', () => {
  expect(modoDeSalvar({ userAgent: UA.iphone, maxTouchPoints: 5, podeCompartilharArquivos: true })).toBe('compartilhar')
})
test('iPhone sem compartilhamento de arquivos: baixar', () => {
  expect(modoDeSalvar({ userAgent: UA.iphone, maxTouchPoints: 5, podeCompartilharArquivos: false })).toBe('baixar')
})
test('iPad que se apresenta como Mac: compartilhar; Mac de verdade: baixar', () => {
  expect(modoDeSalvar({ userAgent: UA.ipadMac, maxTouchPoints: 5, podeCompartilharArquivos: true })).toBe('compartilhar')
  expect(modoDeSalvar({ userAgent: UA.ipadMac, maxTouchPoints: 0, podeCompartilharArquivos: true })).toBe('baixar')
})
test('Android e Windows: baixar, mesmo podendo compartilhar', () => {
  expect(modoDeSalvar({ userAgent: UA.android, maxTouchPoints: 5, podeCompartilharArquivos: true })).toBe('baixar')
  expect(modoDeSalvar({ userAgent: UA.windows, maxTouchPoints: 0, podeCompartilharArquivos: true })).toBe('baixar')
})

const { arquivosParaSalvar } = await import('../../app/src/cliente/acoesPost.js')
const carrosselDe3 = { data: '2026-11-04', rede: 'instagram', tipo: 'carrossel', formato: 'carrossel' }

test('arquivosParaSalvar: um arquivo por página, com nome e tipo', () => {
  const blobs = [1, 2, 3].map((n) => new Blob([String(n)], { type: 'image/png' }))
  const arquivos = arquivosParaSalvar(carrosselDe3, blobs, 'png')
  expect(arquivos.map((a) => a.name)).toEqual([
    '2026-11-04_instagram_carrossel_1.png', '2026-11-04_instagram_carrossel_2.png', '2026-11-04_instagram_carrossel_3.png'])
  expect(arquivos.every((a) => a instanceof File && a.type === 'image/png')).toBe(true)
})
test('arquivosParaSalvar: arquivo único sem número de página', () => {
  const video = { data: '2026-11-07', rede: 'instagram', tipo: 'video', formato: 'montagem' }
  const [arquivo] = arquivosParaSalvar(video, [new Blob(['v'], { type: 'video/mp4' })], 'mp4')
  expect(arquivo.name).toBe('2026-11-07_instagram_montagem.mp4')
  expect(arquivo.type).toBe('video/mp4')
})
