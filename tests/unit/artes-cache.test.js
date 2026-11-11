import { vi, beforeEach, afterEach } from 'vitest'
import { carregarImagem, esquecerImagem, limparImagens, prenderImagens } from '../../app/src/artes/imagens.js'

const supabase = {
  storage: { from: () => ({ createSignedUrl: async (path) => ({ data: { signedUrl: `https://x/${path}` }, error: null }) }) },
}
let criadas

beforeEach(() => {
  criadas = []
  vi.stubGlobal('fetch', async () => ({ ok: true, blob: async () => ({}) }))
  vi.stubGlobal('createImageBitmap', async () => { const b = { close: vi.fn() }; criadas.push(b); return b })
})
afterEach(() => { limparImagens(); vi.unstubAllGlobals() })

const carregarVarias = async (n, de = 1) => { for (let i = de; i < de + n; i++) await carregarImagem(supabase, `p${i}`) }

test('guarda a imagem: a segunda chamada do mesmo path não baixa de novo', async () => {
  const a = await carregarImagem(supabase, 'p1')
  expect(await carregarImagem(supabase, 'p1')).toBe(a)
  expect(criadas).toHaveLength(1)
})

test('o 13º path tira o mais antigo do cache e fecha o bitmap dele', async () => {
  await carregarVarias(12)
  expect(criadas.every((b) => !b.close.mock.calls.length)).toBe(true)
  await carregarImagem(supabase, 'p13')
  expect(criadas[0].close).toHaveBeenCalledTimes(1)
  expect(criadas.slice(1).every((b) => !b.close.mock.calls.length)).toBe(true)
  await carregarImagem(supabase, 'p1') // saiu: baixa de novo
  expect(criadas).toHaveLength(14)
})

test('usar uma imagem a põe no fim da fila', async () => {
  await carregarVarias(12)
  await carregarImagem(supabase, 'p1')
  await carregarImagem(supabase, 'p13')
  expect(criadas[0].close).not.toHaveBeenCalled()
  expect(criadas[1].close).toHaveBeenCalledTimes(1)
})

test('imagem presa (em uso) não sai do cache nem é fechada', async () => {
  const soltar = prenderImagens(['p1'])
  await carregarVarias(13)
  expect(criadas[0].close).not.toHaveBeenCalled()
  expect(criadas[1].close).toHaveBeenCalledTimes(1)
  soltar()
})

test('esquecerImagem fecha o bitmap; se estiver preso, fecha só ao soltar', async () => {
  await carregarImagem(supabase, 'p1')
  esquecerImagem('p1')
  expect(criadas[0].close).toHaveBeenCalledTimes(1)

  const soltar = prenderImagens(['p2'])
  await carregarImagem(supabase, 'p2')
  esquecerImagem('p2')
  expect(criadas[1].close).not.toHaveBeenCalled()
  soltar()
  expect(criadas[1].close).toHaveBeenCalledTimes(1)
  await carregarImagem(supabase, 'p2')
  expect(criadas).toHaveLength(3)
})

test('limparImagens fecha tudo e esvazia o cache', async () => {
  await carregarVarias(3)
  limparImagens()
  expect(criadas.every((b) => b.close.mock.calls.length === 1)).toBe(true)
  await carregarImagem(supabase, 'p1')
  expect(criadas).toHaveLength(4)
})

test('falha ao carregar devolve null e não fica guardada', async () => {
  vi.stubGlobal('createImageBitmap', async () => { throw new Error('ruim') })
  expect(await carregarImagem(supabase, 'p1')).toBeNull()
  vi.stubGlobal('createImageBitmap', async () => { const b = { close: vi.fn() }; criadas.push(b); return b })
  expect(await carregarImagem(supabase, 'p1')).not.toBeNull()
})
