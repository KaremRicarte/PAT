import { vi } from 'vitest'
import { caminhoDaFotoDoPost, opcoesDeFoto, gravarEscolhaDeFoto } from '../../app/src/cliente/trocarFoto.js'
import { aviso } from '../../app/src/comum.js'
import { reduzirFoto } from '../../app/src/cliente/negocio.js'
import { esquecerImagem } from '../../app/src/artes/imagens.js'

vi.mock('../../app/src/comum.js', () => ({ aviso: vi.fn(), el: vi.fn() }))
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
  expect(fotos.find((f) => f.atual)?.path).toBe('u1/produtos/a.jpg') // fora do textOnly vale a primeira foto
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
  const uploads = [], updates = []
  const supabase = {
    storage: { from: (bucket) => ({ upload: async (caminho, blob, opcoes) => { uploads.push({ bucket, caminho, blob, opcoes }); return { error: erroUpload } } }) },
    from: () => ({ update: (mudanca) => ({ eq: () => ({ select: () => ({ single: async () => { updates.push(mudanca); return { data: mudanca, error: null } } }) }) }) }),
  }
  return { supabase, uploads, updates }
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
