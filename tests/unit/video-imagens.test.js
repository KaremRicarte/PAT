import { vi, beforeEach, afterEach } from 'vitest'

// A gravação em si fica de fora: o que importa aqui é que fotos e logo ficam presos durante ela.
const gravacao = vi.hoisted(() => ({ durante: null }))
vi.mock('../../app/src/artes/video.js', () => ({
  montarVideoDeFotos: vi.fn(async (opcoes) => { await gravacao.durante?.(opcoes); return { blob: 'b', ext: 'mp4' } }),
  editarVideo: vi.fn(async (arquivo, opcoes) => { await gravacao.durante?.(opcoes); return { blob: 'v', ext: 'webm' } }),
}))

const { gerarVideoDeFotos, gerarVideoEditado, carregarImagem, limparImagens } = await import('../../app/src/artes/imagens.js')
const video = await import('../../app/src/artes/video.js')

const supabase = {
  storage: { from: () => ({ createSignedUrl: async (path) => ({ data: { signedUrl: `https://x/${path}` }, error: null }) }) },
}
const negocio = { nome: 'Loja', insta: 'loja', assinatura: 'ambos', logo_path: 'u/logo.png', cor1: '#F2A21B', cor2: '#151925' }
const post = { titulo: 'Título', legenda: 'Gancho\n\nMeio\n\nConvite', tipo: 'video', formato: 'montagem' }
let criadas

beforeEach(() => {
  criadas = []
  gravacao.durante = null
  vi.stubGlobal('fetch', async () => ({ ok: true, blob: async () => ({}) }))
  vi.stubGlobal('createImageBitmap', async () => { const b = { close: vi.fn() }; criadas.push(b); return b })
})
afterEach(() => { limparImagens(); vi.unstubAllGlobals(); vi.clearAllMocks() })

const encherCache = async () => { for (let i = 0; i < 14; i++) await carregarImagem(supabase, `outra${i}`) }

test('gerarVideoDeFotos: fotos e logo presos durante a gravação, soltos no fim', async () => {
  let fotosNaGravacao
  gravacao.durante = async (opcoes) => { fotosNaGravacao = [...opcoes.fotos, opcoes.logo]; await encherCache() }
  const r = await gerarVideoDeFotos(supabase, post, { negocio, ramo: { id: 'ferramentas' } }, ['u/f1.jpg', 'u/f2.jpg'])
  expect(r).toEqual({ blob: 'b', ext: 'mp4' })
  const opcoes = video.montarVideoDeFotos.mock.calls[0][0]
  expect(opcoes.fotos).toHaveLength(2)
  expect(opcoes.pecas.assinatura).toEqual({ texto: '@loja', logo: true })
  expect(fotosNaGravacao.every((b) => !b.close.mock.calls.length)).toBe(true) // não fechou no meio
  await encherCache()
  expect(fotosNaGravacao.every((b) => b.close.mock.calls.length === 1)).toBe(true) // soltou
})

test('gerarVideoEditado: solta o logo mesmo quando a edição falha', async () => {
  let logo
  gravacao.durante = async (opcoes) => { logo = opcoes.logo; await encherCache(); throw Object.assign(new Error('x'), { codigo: 'longo' }) }
  const arquivo = { name: 'v.mp4' }, audio = { audioCtx: { fake: 1 }, audioExtra: { trilha: 1 } }, progresso = () => {}
  await expect(gerarVideoEditado(supabase, post, { negocio, ramo: null }, arquivo, progresso, audio)).rejects.toMatchObject({ codigo: 'longo' })
  const [arq, dados, aoProgredir, opcoesDeAudio] = video.editarVideo.mock.calls[0]
  expect(arq).toBe(arquivo)
  expect(aoProgredir).toBe(progresso)
  expect(opcoesDeAudio).toBe(audio)
  expect(dados.assinatura).toEqual({ texto: '@loja', logo: true })
  expect(logo.close).not.toHaveBeenCalled()
  await encherCache()
  expect(logo.close).toHaveBeenCalledTimes(1)
})
