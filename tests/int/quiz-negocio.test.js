import { randomUUID } from 'node:crypto'
import { servico, novoCliente, limpar, criados } from './ajuda.js'
import { salvarNegocio, carregarNegocio } from '../../app/src/cliente/negocio.js'

afterEach(() => limpar(criados.splice(0)))

const png = () => new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })
const jpg = () => new Blob([new Uint8Array([255, 216, 255, 224])], { type: 'image/jpeg' })
const dados = (extra = {}) => ({
  nome: ' Studio Bella ', insta: '@studiobella', assinatura: 'ambos', tom: 'proximo', horario: '12:00',
  cor1: '#B76E79', cor2: '#F6EFEA', logo_path: null, logoBlob: png(), ...extra,
})

test('salva o negócio com logo e fotos, depois edita removendo um item', async () => {
  const a = await novoCliente({ senha_provisoria: false, ramo: 'beleza' })
  const i1 = randomUUID(), i2 = randomUUID()
  await salvarNegocio(a.db, a.id, dados(), [
    { id: i1, nome: 'Limpeza de pele', descricao: ' 1h ', preco: 180, foto_path: null, fotoBlob: jpg() },
    { id: i2, nome: 'Sobrancelha', descricao: '', preco: null, foto_path: null, fotoBlob: null },
  ])

  const { negocio, produtos } = await carregarNegocio(a.db, a.id)
  expect(negocio).toMatchObject({ nome: 'Studio Bella', horario: '12:00', logo_path: `${a.id}/logo.png` })
  expect(produtos).toEqual([
    { id: i1, nome: 'Limpeza de pele', descricao: '1h', preco: 180, foto_path: `${a.id}/produtos/${i1}.jpg` },
    { id: i2, nome: 'Sobrancelha', descricao: null, preco: null, foto_path: null },
  ])

  // edição: tira o primeiro item, mantém a logo já enviada
  await salvarNegocio(a.db, a.id, dados({ logoBlob: null, logo_path: negocio.logo_path, nome: 'Studio Bella Pele' }),
    [{ ...produtos[1], descricao: 'Design', fotoBlob: null }])
  const depois = await carregarNegocio(a.db, a.id)
  expect(depois.negocio.nome).toBe('Studio Bella Pele')
  expect(depois.negocio.logo_path).toBe(`${a.id}/logo.png`)
  expect(depois.produtos.map((p) => [p.nome, p.descricao])).toEqual([['Sobrancelha', 'Design']])

  const { data: arquivos } = await servico().storage.from('marcas').list(`${a.id}/produtos`)
  expect(arquivos.map((f) => f.name)).toEqual([])
  await servico().storage.from('marcas').remove([`${a.id}/logo.png`])
})
