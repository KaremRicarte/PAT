import { randomUUID } from 'node:crypto'
import { servico, novoCliente, limpar, criados } from './ajuda.js'
import { salvarNegocio, carregarNegocio } from '../../app/src/cliente/negocio.js'

const nomes = async (pasta) => (await servico().storage.from('marcas').list(pasta)).data.map((f) => f.name)

afterEach(() => limpar(criados.splice(0)))

const png = () => new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })
const jpg = () => new Blob([new Uint8Array([255, 216, 255, 224])], { type: 'image/jpeg' })
const reduzir = async (b) => b
const opc = { reduzir }
const dados = (extra = {}) => ({
  nome: ' Studio Bella ', insta: '@studiobella', assinatura: 'ambos', tom: 'proximo', horario: '12:00',
  cor1: '#B76E79', cor2: '#F6EFEA', logo_path: null, logoBlob: png(), ...extra,
})

test('salva o negócio com logo e fotos, depois edita removendo um item', async () => {
  const a = await novoCliente({ senha_provisoria: false, ramo: 'beleza' })
  const i1 = randomUUID(), i2 = randomUUID()
  await salvarNegocio(a.db, a.id, dados(), [
    { id: i1, nome: 'Limpeza de pele', descricao: ' 1h ', preco: 180, preco_promo: null, fotos: [{ arquivo: jpg(), nome: 'a.jpg' }] },
    { id: i2, nome: 'Sobrancelha', descricao: '', preco: null, preco_promo: null, fotos: [] },
  ], undefined, opc)

  const { negocio, produtos } = await carregarNegocio(a.db, a.id)
  expect(negocio).toMatchObject({ nome: 'Studio Bella', horario: '12:00', logo_path: `${a.id}/logo.png` })
  expect(produtos).toHaveLength(2)
  expect(produtos[0]).toMatchObject({ id: i1, nome: 'Limpeza de pele', descricao: '1h', preco: 180, preco_promo: null })
  expect(produtos[0].fotos).toHaveLength(1)
  expect(produtos[0].fotos[0]).toMatch(new RegExp(`^${a.id}/produtos/${i1}/[0-9a-f-]+\.jpg$`))
  expect(produtos[0].foto_path).toBe(produtos[0].fotos[0])
  expect(produtos[1]).toMatchObject({ id: i2, descricao: null, preco: null, foto_path: null, fotos: [] })

  // edição: tira o primeiro item, mantém a logo já enviada
  await salvarNegocio(a.db, a.id, dados({ logoBlob: null, logo_path: negocio.logo_path, nome: 'Studio Bella Pele' }),
    [{ ...produtos[1], descricao: 'Design', fotos: [] }], undefined, opc)
  const depois = await carregarNegocio(a.db, a.id)
  expect(depois.negocio.nome).toBe('Studio Bella Pele')
  expect(depois.negocio.logo_path).toBe(`${a.id}/logo.png`)
  expect(depois.produtos.map((p) => [p.nome, p.descricao])).toEqual([['Sobrancelha', 'Design']])

  expect(await nomes(`${a.id}/produtos/${i1}`)).toEqual([])
  await servico().storage.from('marcas').remove([`${a.id}/logo.png`])
})

test('salva 2 fotos novas, depois remove 1: banco e Storage acompanham', async () => {
  const a = await novoCliente({ senha_provisoria: false, ramo: 'beleza' })
  const id = randomUUID()
  const progresso = []
  await salvarNegocio(a.db, a.id, dados(), [
    { id, nome: 'Corte', descricao: '', preco: 100, preco_promo: 80,
      fotos: [{ arquivo: jpg(), nome: '1.jpg' }, { arquivo: jpg(), nome: '2.jpg' }] },
  ], (f, t) => progresso.push([f, t]), opc)
  expect(progresso.at(-1)).toEqual(progresso.at(-1)) // chamado
  expect(progresso.length).toBeGreaterThan(0)
  const { produtos } = await carregarNegocio(a.db, a.id)
  expect(produtos[0].fotos).toHaveLength(2)
  expect(produtos[0].foto_path).toBe(produtos[0].fotos[0])
  expect(await nomes(`${a.id}/produtos/${id}`)).toHaveLength(2)

  const [p1, p2] = produtos[0].fotos
  await salvarNegocio(a.db, a.id, dados({ logoBlob: null }), [
    { id, nome: 'Corte', descricao: '', preco: 100, preco_promo: 80, fotos: [{ path: p2 }] },
  ], undefined, opc)
  const depois = await carregarNegocio(a.db, a.id)
  expect(depois.produtos[0].fotos).toEqual([p2])
  expect(depois.produtos[0].foto_path).toBe(p2)
  expect(await nomes(`${a.id}/produtos/${id}`)).toEqual([p2.split('/').pop()])
  expect(p1).not.toBe(p2)
  await servico().storage.from('marcas').remove([p2, `${a.id}/logo.png`])
})

test('apagar o item apaga as fotos dele', async () => {
  const a = await novoCliente({ senha_provisoria: false, ramo: 'beleza' })
  const id = randomUUID(), outro = randomUUID()
  await salvarNegocio(a.db, a.id, dados(), [
    { id, nome: 'Corte', descricao: '', preco: 100, preco_promo: null, fotos: [{ arquivo: jpg(), nome: '1.jpg' }] },
    { id: outro, nome: 'Barba', descricao: '', preco: 50, preco_promo: null, fotos: [] },
  ], undefined, opc)
  expect(await nomes(`${a.id}/produtos/${id}`)).toHaveLength(1)
  await salvarNegocio(a.db, a.id, dados({ logoBlob: null }), [
    { id: outro, nome: 'Barba', descricao: '', preco: 50, preco_promo: null, fotos: [] },
  ], undefined, opc)
  expect(await nomes(`${a.id}/produtos/${id}`)).toEqual([])
  await servico().storage.from('marcas').remove([`${a.id}/logo.png`])
})

test('preço promocional gravado', async () => {
  const a = await novoCliente({ senha_provisoria: false, ramo: 'beleza' })
  const id = randomUUID(), semNormal = randomUUID()
  await salvarNegocio(a.db, a.id, dados(), [
    { id, nome: 'Corte', descricao: '', preco: 100, preco_promo: 79.9, fotos: [] },
    { id: semNormal, nome: 'Barba', descricao: '', preco: null, preco_promo: 40, fotos: [] },
  ], undefined, opc)
  const { produtos } = await carregarNegocio(a.db, a.id)
  expect(produtos.map((p) => [p.preco, p.preco_promo])).toEqual([[100, 79.9], [null, null]])
  await servico().storage.from('marcas').remove([`${a.id}/logo.png`])
})
