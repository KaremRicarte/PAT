import { vi } from 'vitest'
import { caminhoDaFotoDoPost, opcoesDeFoto, gravarEscolhaDeFoto } from '../../app/src/cliente/trocarFoto.js'
import { aviso } from '../../app/src/comum.js'
import { reduzirFoto } from '../../app/src/cliente/negocio.js'
import { esquecerImagem } from '../../app/src/artes/imagens.js'

vi.mock('../../app/src/comum.js', () => ({ aviso: vi.fn(), el: vi.fn(), invocar: (sb, nome, o) => sb.functions.invoke(nome, o) }))
vi.mock('../../app/src/cliente/negocio.js', () => ({ reduzirFoto: vi.fn(), FOTO_MAX: 1600 }))
vi.mock('../../app/src/artes/imagens.js', () => ({ esquecerImagem: vi.fn(), carregarImagem: vi.fn(), prenderImagens: vi.fn() }))
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

const produtos = [
  { id: 'a', nome: 'Corte', foto_path: 'u1/produtos/a.jpg' },
  { id: 'b', nome: 'Escova', foto_path: null },
  { id: 'c', nome: 'Unha', foto_path: 'u1/produtos/c.jpg' },
]

test('caminhoDaFotoDoPost: a foto nova fica na pasta do cliente', () => {
  expect(caminhoDaFotoDoPost('u1', 'p9')).toBe('u1/posts/p9.jpg')
})

test('opcoesDeFoto: sem foto_path, a atual é a do produto do post', () => {
  const { fotos } = opcoesDeFoto(produtos, RAMOS.beleza, { produto_id: 'c', foto_path: null, sem_foto: false })
  expect(fotos).toEqual([
    { path: 'u1/produtos/a.jpg', atual: false },
    { path: 'u1/produtos/c.jpg', atual: true },
  ])
})

test('opcoesDeFoto: produtos sem foto ficam fora', () => {
  const { fotos } = opcoesDeFoto(produtos, RAMOS.beleza, { produto_id: 'b', foto_path: null, sem_foto: false })
  expect(fotos.map((f) => f.path)).toEqual(['u1/produtos/a.jpg', 'u1/produtos/c.jpg'])
  expect(fotos.find((f) => f.atual)).toBeUndefined() // o serviço do post não tem foto: arte só com texto, nenhuma marcada
})

test('opcoesDeFoto: a foto enviada para o post entra primeiro, marcada', () => {
  const { fotos } = opcoesDeFoto(produtos, RAMOS.beleza, { produto_id: 'a', foto_path: 'u1/posts/p1.jpg', sem_foto: false })
  expect(fotos[0]).toEqual({ path: 'u1/posts/p1.jpg', atual: true })
  expect(fotos.filter((f) => f.atual)).toHaveLength(1)
})

test('opcoesDeFoto: "Sem foto" só em advocacia e psicologia', () => {
  const post = { produto_id: 'a', foto_path: null, sem_foto: false }
  const comSemFoto = Object.values(RAMOS).filter((r) => opcoesDeFoto(produtos, r, post).semFoto).map((r) => r.id).sort()
  expect(comSemFoto).toEqual(['advocacia', 'psicologia'])
})

test('opcoesDeFoto: com sem_foto num ramo textOnly, nenhuma foto é a atual', () => {
  const { fotos } = opcoesDeFoto(produtos, RAMOS.advocacia, { produto_id: 'a', foto_path: null, sem_foto: true })
  expect(fotos.some((f) => f.atual)).toBe(false)
})

// ---------- gravarEscolhaDeFoto ----------
// supabase falso: guarda os uploads e os updates; o update devolve o post já mudado.
function falso({ erroUpload = null } = {}) {
  const uploads = [], updates = [], apagadas = []
  const supabase = {
    storage: { from: (bucket) => ({ upload: async (caminho, blob, opcoes) => { uploads.push({ bucket, caminho, blob, opcoes }); return { error: erroUpload } } }) },
    from: (tabela) => (tabela === 'fotos_ia'
      ? { delete: () => ({ eq: async (coluna, valor) => { apagadas.push([coluna, valor]); return { error: null } } }) }
      : { update: (mudanca) => ({ eq: () => ({ select: () => ({ single: async () => { updates.push(mudanca); return { data: mudanca, error: null } } }) }) }) }),
  }
  return { supabase, uploads, updates, apagadas }
}

test('foto nova: reduz para JPEG, sobe para a pasta do post e grava o caminho', async () => {
  const blob = { tipo: 'jpeg' }
  reduzirFoto.mockResolvedValueOnce(blob)
  const { supabase, uploads, updates } = falso()
  const post = { id: 'p1', foto_path: null, sem_foto: true }
  const arquivo = { name: 'x.heic' }
  expect(await gravarEscolhaDeFoto({ supabase, uid: 'u1', post, escolha: { arquivo } })).toBe(true)
  expect(reduzirFoto).toHaveBeenCalledWith(arquivo, 1600, 'image/jpeg')
  expect(uploads).toEqual([{ bucket: 'marcas', caminho: 'u1/posts/p1.jpg', blob, opcoes: { upsert: true, contentType: 'image/jpeg' } }])
  expect(esquecerImagem).toHaveBeenCalledWith('u1/posts/p1.jpg')
  expect(updates).toEqual([{ foto_path: 'u1/posts/p1.jpg', sem_foto: false }])
  expect(post).toMatchObject({ foto_path: 'u1/posts/p1.jpg', sem_foto: false })
})

test('foto que o navegador não abre: avisa e não envia nem grava', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  reduzirFoto.mockRejectedValueOnce(new Error('não abre'))
  const { supabase, uploads, updates } = falso()
  const post = { id: 'p2', foto_path: 'u1/produtos/a.jpg', sem_foto: false }
  expect(await gravarEscolhaDeFoto({ supabase, uid: 'u1', post, escolha: { arquivo: {} } })).toBe(false)
  expect(aviso).toHaveBeenCalledWith('Não consegui abrir esta foto. Tente outra.')
  expect(uploads).toEqual([])
  expect(updates).toEqual([])
  expect(post.foto_path).toBe('u1/produtos/a.jpg')
})

test('envio da foto falhou: sem conexão e a foto anterior continua', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  reduzirFoto.mockResolvedValueOnce({})
  const { supabase, updates } = falso({ erroUpload: { message: 'offline' } })
  const post = { id: 'p3', foto_path: null, sem_foto: false }
  expect(await gravarEscolhaDeFoto({ supabase, uid: 'u1', post, escolha: { arquivo: {} } })).toBe(false)
  expect(aviso).toHaveBeenCalledWith('Sem conexão. Tente de novo.')
  expect(updates).toEqual([])
  expect(post.foto_path).toBe(null)
})

test('foto já enviada e "Sem foto" só gravam o post', async () => {
  const { supabase, uploads, updates } = falso()
  const post = { id: 'p4', foto_path: null, sem_foto: false }
  await gravarEscolhaDeFoto({ supabase, uid: 'u1', post, escolha: { foto_path: 'u1/produtos/c.jpg' } })
  await gravarEscolhaDeFoto({ supabase, uid: 'u1', post, escolha: { sem_foto: true } })
  expect(uploads).toEqual([])
  expect(updates).toEqual([{ foto_path: 'u1/produtos/c.jpg', sem_foto: false }, { sem_foto: true }])
})

test('post com outra gravação em andamento: avisa para esperar em vez de ficar em silêncio', async () => {
  const { gravarMudanca } = await import('../../app/src/cliente/acoesPost.js')
  const post = { id: 'p5', foto_path: null, sem_foto: false }
  let liberar
  const lento = { from: () => ({ update: () => ({ eq: () => ({ select: () => ({ single: () => new Promise((ok) => { liberar = () => ok({ data: {}, error: null }) }) }) }) }) }) }
  const primeira = gravarMudanca({ supabase: lento, post, mudanca: { sem_foto: true } })
  aviso.mockClear()
  const { supabase, updates } = falso()
  expect(await gravarEscolhaDeFoto({ supabase, uid: 'u1', post, escolha: { foto_path: 'u1/produtos/c.jpg' } })).toBe(false)
  expect(aviso).toHaveBeenCalledWith('Espere a última ação terminar.')
  expect(updates).toEqual([])
  liberar()
  await primeira
})

test('opcoesDeFoto lista todas as fotos de todos os itens, sem repetir', () => {
  const ps = [{ id: 'x', fotos: ['a', 'b'] }, { id: 'y', fotos: ['b', 'c'] }]
  const { fotos } = opcoesDeFoto(ps, RAMOS.beleza, { produto_id: 'x', ordem: 1, foto_path: null, sem_foto: false })
  expect(fotos.map((f) => f.path)).toEqual(['a', 'b', 'c'])
  expect(fotos.find((f) => f.atual).path).toBe('b')
})

// ---------- Depois de trocar a foto, a IA reescreve a legenda (reescrever-post) ----------
// supabase falso com update e functions.invoke
function comFuncao(resposta) {
  const { supabase, updates } = falso()
  const chamadas = []
  supabase.functions = { invoke: async (nome, opcoes) => { chamadas.push({ nome, opcoes }); return resposta() } }
  return { supabase, updates, chamadas }
}
const POST_GERADO = (id) => ({ id, estado: 'gerado', postado_em: null, foto_path: null, sem_foto: false, legenda: 'antiga', titulo: 'T', origem: 'modelo' })

test('foto trocada: "Escrevendo…" enquanto a IA reescreve e o post devolvido é aplicado', async () => {
  const novo = { id: 'r1', titulo: 'Novo', legenda: 'nova', hashtags: ['#x'], roteiro: null, origem: 'ia', ia_estado: 'pronto' }
  const { supabase, chamadas } = comFuncao(async () => ({ data: { post: novo }, error: null }))
  const post = POST_GERADO('r1')
  const estados = []
  const aoMudarTexto = vi.fn(() => estados.push(`texto:${post.legenda}`))
  const ok = await gravarEscolhaDeFoto({
    supabase, uid: 'u1', post, escolha: { foto_path: 'u1/produtos/c.jpg' },
    aoEscrevendo: (sim) => estados.push(`escrevendo:${sim}`), aoMudarTexto,
  })
  expect(ok).toBe(true)
  expect(chamadas).toEqual([{ nome: 'reescrever-post', opcoes: { body: { post_id: 'r1' } } }])
  expect(estados).toEqual(['escrevendo:true', 'texto:nova', 'escrevendo:false'])
  expect(post).toMatchObject({ foto_path: 'u1/produtos/c.jpg', titulo: 'Novo', legenda: 'nova', origem: 'ia', ia_estado: 'pronto' })
})

test('IA sem texto novo ({ post: null }) ou função fora do ar: a foto fica trocada e o texto como estava, sem erro', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  for (const resposta of [
    async () => ({ data: { post: null }, error: null }),
    async () => ({ data: null, error: { name: 'FunctionsFetchError' } }),
    async () => { throw new TypeError('Failed to fetch') },
  ]) {
    aviso.mockClear()
    const { supabase } = comFuncao(resposta)
    const post = POST_GERADO('r2')
    const aoMudarTexto = vi.fn()
    expect(await gravarEscolhaDeFoto({ supabase, uid: 'u1', post, escolha: { foto_path: 'u1/produtos/c.jpg' }, aoMudarTexto })).toBe(true)
    expect(aoMudarTexto).not.toHaveBeenCalled()
    expect(post).toMatchObject({ foto_path: 'u1/produtos/c.jpg', legenda: 'antiga' })
    expect(aviso).not.toHaveBeenCalled()
  }
})

test('"Sem foto" também reescreve (o texto pode falar da foto antiga)', async () => {
  const { supabase, chamadas } = comFuncao(async () => ({ data: { post: null }, error: null }))
  await gravarEscolhaDeFoto({ supabase, uid: 'u1', post: POST_GERADO('r3'), escolha: { sem_foto: true } })
  expect(chamadas.map((c) => c.nome)).toEqual(['reescrever-post'])
})

test('post aprovado ou postado: a foto troca, mas o texto que o cliente aceitou não é reescrito', async () => {
  for (const mudanca of [{ estado: 'aprovado' }, { postado_em: '2026-11-20T12:00:00Z' }]) {
    const { supabase, chamadas } = comFuncao(async () => ({ data: { post: { legenda: 'x' } }, error: null }))
    const post = { ...POST_GERADO('r4'), ...mudanca }
    expect(await gravarEscolhaDeFoto({ supabase, uid: 'u1', post, escolha: { foto_path: 'u1/produtos/c.jpg' } })).toBe(true)
    expect(chamadas).toEqual([])
  }
})

test('foto que não gravou: nada de reescrever', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  reduzirFoto.mockResolvedValueOnce({})
  const { supabase: s, chamadas } = comFuncao(async () => ({ data: { post: { legenda: 'x' } }, error: null }))
  s.storage = { from: () => ({ upload: async () => ({ error: { message: 'offline' } }) }) }
  expect(await gravarEscolhaDeFoto({ supabase: s, uid: 'u1', post: POST_GERADO('r5'), escolha: { arquivo: {} } })).toBe(false)
  expect(chamadas).toEqual([])
})

test('o texto mudou no aparelho enquanto a IA escrevia (ex.: Gerar outro): a resposta atrasada não o sobrescreve', async () => {
  const post = POST_GERADO('r6')
  const { supabase } = comFuncao(async () => { post.legenda = 'do Gerar outro'; return { data: { post: { id: 'r6', legenda: 'da IA' } }, error: null } })
  const aoMudarTexto = vi.fn()
  await gravarEscolhaDeFoto({ supabase, uid: 'u1', post, escolha: { foto_path: 'u1/produtos/c.jpg' }, aoMudarTexto })
  expect(post.legenda).toBe('do Gerar outro')
  expect(aoMudarTexto).not.toHaveBeenCalled()
})

test('foto nova no mesmo caminho: a análise antiga sai (banco e mapa) e uma nova é pedida', async () => {
  reduzirFoto.mockResolvedValueOnce({})
  const { supabase, apagadas, updates } = falso()
  const chamadas = []
  supabase.functions = { invoke: async (nome, opcoes) => { chamadas.push({ nome, opcoes }); return { data: { post: null }, error: null } } }
  const fotosInfo = new Map([['u1/posts/r7.jpg', { serve: false, motivo: 'escura' }], ['u1/produtos/a.jpg', { serve: true }]])
  const post = POST_GERADO('r7')
  expect(await gravarEscolhaDeFoto({ supabase, uid: 'u1', post, escolha: { arquivo: {} }, fotosInfo })).toBe(true)
  expect(apagadas).toEqual([['path', 'u1/posts/r7.jpg']])
  expect([...fotosInfo.keys()]).toEqual(['u1/produtos/a.jpg'])
  expect(updates).toEqual([{ foto_path: 'u1/posts/r7.jpg', sem_foto: false }])
  expect(chamadas).toContainEqual({ nome: 'descrever-fotos', opcoes: { body: { paths: ['u1/posts/r7.jpg'] } } })
})

test('apagar a análise antiga falhou: a troca segue mesmo assim', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  reduzirFoto.mockResolvedValueOnce({})
  const { supabase, updates } = falso()
  const original = supabase.from
  supabase.from = (tabela) => (tabela === 'fotos_ia' ? { delete: () => ({ eq: async () => { throw new Error('offline') } }) } : original(tabela))
  expect(await gravarEscolhaDeFoto({ supabase, uid: 'u1', post: { id: 'r8', foto_path: null, sem_foto: false }, escolha: { arquivo: {} } })).toBe(true)
  expect(updates).toEqual([{ foto_path: 'u1/posts/r8.jpg', sem_foto: false }])
})

test('foto escolhida da lista (não enviada): nada de apagar análise', async () => {
  const { supabase, apagadas } = falso()
  await gravarEscolhaDeFoto({ supabase, uid: 'u1', post: { id: 'r9', foto_path: null, sem_foto: false }, escolha: { foto_path: 'u1/produtos/c.jpg' } })
  expect(apagadas).toEqual([])
})
