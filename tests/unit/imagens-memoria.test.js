import { vi, beforeEach, afterEach } from 'vitest'

// iPhone: canvas grandes temporários precisam ser zerados (width = height = 0) para devolver a memória.
vi.mock('../../app/src/artes/desenho.js', async (original) => ({ ...(await original()), desenharArte: vi.fn() }))
const { miniatura, gerarImagens, limparImagens } = await import('../../app/src/artes/imagens.js')

const supabase = {
  storage: { from: () => ({ createSignedUrl: async (path) => ({ data: { signedUrl: `https://x/${path}` }, error: null }) }) },
}
const negocio = { nome: 'Loja', insta: 'loja', assinatura: 'ambos', logo_path: 'u/logo.png', cor1: '#F2A21B', cor2: '#151925' }
let telas

function telaFalsa() {
  const c = {
    width: 0, height: 0, desenhadaEm: [],
    getContext: () => ({ drawImage: (img) => { c.desenhadaEm.push({ img, largura: img.width }) } }),
    toBlob: (cb) => cb({ png: true, largura: c.width }),
  }
  telas.push(c)
  return c
}

beforeEach(() => {
  telas = []
  vi.stubGlobal('document', { createElement: () => telaFalsa(), fonts: { load: async () => {} } })
  vi.stubGlobal('fetch', async () => ({ ok: true, blob: async () => ({}) }))
  vi.stubGlobal('createImageBitmap', async () => ({ close: vi.fn() }))
})
afterEach(() => { limparImagens(); vi.unstubAllGlobals() })

test('miniatura: desenha a página grande na pequena e zera a grande', async () => {
  const post = { titulo: 'T', legenda: 'a\n\nb\n\nc', tipo: 'feed', formato: 'post' }
  const pequena = await miniatura(supabase, post, { negocio, ramo: null }, 240)
  const [grande] = telas
  expect(pequena).toBe(telas[1])
  expect(pequena.width).toBe(240)
  expect(pequena.desenhadaEm[0].img).toBe(grande)
  expect(pequena.desenhadaEm[0].largura).toBe(1080) // desenhada antes de zerar
  expect([grande.width, grande.height]).toEqual([0, 0])
})

test('gerarImagens: cada canvas é zerado depois de virar PNG', async () => {
  const post = { titulo: 'T', legenda: 'a\n\nb\n\nc', tipo: 'feed', formato: 'carrossel' }
  const pngs = await gerarImagens(supabase, post, { negocio, ramo: null })
  expect(pngs).toHaveLength(5)
  expect(pngs.every((p) => p.png && p.largura === 1080)).toBe(true)
  expect(telas).toHaveLength(5)
  expect(telas.every((c) => c.width === 0 && c.height === 0)).toBe(true)
})
