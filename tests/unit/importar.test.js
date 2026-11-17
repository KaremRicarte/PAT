import { normalizarNome, chaveDaFoto, decodificarTexto, lerLista, juntarImportacao } from '../../app/src/cliente/importar.js'

describe('lerLista', () => {
  test('quatro linhas', () => {
    const r = lerLista('Gramado;2199;1799\nLeste Europeu;10299;9999\nportoseguro;1999;1999\nportugal;0;0')
    expect(r.erros).toEqual([])
    expect(r.linhas).toHaveLength(4)
    expect(r.linhas[0]).toEqual({ linha: 1, nome: 'Gramado', preco: 2199, promo: 1799 })
    expect(r.linhas[3]).toEqual({ linha: 4, nome: 'portugal', preco: null, promo: null })
  })
  test('colunas ausentes e comentarios', () => {
    expect(lerLista('portugal').linhas[0]).toMatchObject({ preco: undefined, promo: undefined })
    const r = lerLista('# comentário\n\n  \nXy;10;')
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0]).toMatchObject({ preco: 10, promo: undefined })
  })
  test('formato brasileiro e separadores', () => {
    expect(lerLista('AB;R$ 2.199,90;1.999,90').linhas[0]).toMatchObject({ preco: 2199.9, promo: 1999.9 })
    expect(lerLista('Gramado,2199,1799').linhas[0]).toMatchObject({ nome: 'Gramado', preco: 2199, promo: 1799 })
    expect(lerLista('Leste Europeu;10.299;9.999').linhas[0]).toMatchObject({ preco: 10299, promo: 9999 })
    expect(lerLista('AB;1,50;1').linhas[0]).toMatchObject({ preco: 1.5, promo: 1 })
  })
  test('erros', () => {
    expect(lerLista('AB;0;10').erros).toEqual([{ linha: 1, chave: 'importar.erro.semnormal' }])
    expect(lerLista('AB;100;150').erros).toEqual([{ linha: 1, chave: 'importar.erro.promomaior' }])
    expect(lerLista('XY;abc;1').erros).toEqual([{ linha: 1, chave: 'importar.erro.preco' }])
    expect(lerLista('A;5;5').erros).toEqual([{ linha: 1, chave: 'importar.erro.nome' }])
    expect(lerLista('a'.repeat(81) + ';5;5').erros).toEqual([{ linha: 1, chave: 'importar.erro.nome' }])
  })
})

describe('nomes', () => {
  test('chaveDaFoto e normalizarNome', () => {
    expect(chaveDaFoto('Leste-Europeu_1.JPG')).toBe('lesteeuropeu')
    expect(chaveDaFoto('gramado.jpg')).toBe('gramado')
    expect(normalizarNome('São Paulo')).toBe('saopaulo')
  })
})

describe('decodificarTexto', () => {
  test('windows-1252', () => {
    const b = new Uint8Array(['S'.charCodeAt(0), 0xe3, ...[...'o Paulo;1;1'].map((c) => c.charCodeAt(0))])
    expect(decodificarTexto(b.buffer)).toBe('São Paulo;1;1')
  })
  test('utf-8 com BOM', () => {
    const b = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('São;1;1')])
    expect(decodificarTexto(b.buffer)).toBe('São;1;1')
  })
})

describe('juntarImportacao', () => {
  const mkId = () => { let n = 0; return () => `n${++n}` }
  const arq = (name) => ({ name })
  const ent = (texto, arquivosDeFoto = []) => ({ ...lerLista(texto), arquivosDeFoto })
  const opc = (noPromo = false) => ({ noPromo, novoId: mkId() })

  test('junta: cria novos e atualiza preços sem apagar', () => {
    const atual = [{ id: 'a', nome: 'Gramado', precoTexto: '2000', fotos: [{ path: 'u/p/a.jpg' }] }, { id: 'b', nome: 'Bonito' }]
    const r = juntarImportacao(atual, ent('Gramado;2199;1799\nLeste Europeu;10299;9999\nportoseguro;1999;1999\nportugal;0;0'), opc())
    expect(r.itens).toHaveLength(5)
    expect(r.itens[0]).toMatchObject({ nome: 'Gramado', precoTexto: '2199', promoTexto: '1799', fotos: [{ path: 'u/p/a.jpg' }] })
    expect(r.itens[1].nome).toBe('Bonito')
    expect(r.itens[2]).toMatchObject({ id: 'n1', nome: 'Leste Europeu', precoTexto: '10299', novo: true, descricao: '', fotos: [] })
    expect(r.resumo).toMatchObject({ novos: 3, atualizados: 1 })
  })
  test('linha só com nome não mexe no preço', () => {
    const r = juntarImportacao([{ id: 'a', nome: 'Gramado', precoTexto: '2000', promoTexto: '1500' }], ent('gramado'), opc())
    expect(r.itens[0]).toMatchObject({ nome: 'Gramado', precoTexto: '2000', promoTexto: '1500' })
  })
  test('0 limpa o preço', () => {
    const r = juntarImportacao([{ id: 'a', nome: 'Gramado', precoTexto: '2000', promoTexto: '1500' }], ent('Gramado;0;0'), opc())
    expect(r.itens[0]).toMatchObject({ precoTexto: '', promoTexto: '' })
  })
  test('centavos viram texto com vírgula', () => {
    const r = juntarImportacao([], ent('Gramado;2199,9'), opc())
    expect(r.itens[0].precoTexto).toBe('2199,90')
  })
  test('fotos vão pelo começo do nome', () => {
    const atual = [{ id: 'a', nome: 'Leste Europeu' }]
    const r = juntarImportacao(atual, ent('', [arq('lesteeuropeu_1.jpg'), arq('Leste-Europeu_2.JPG'), arq('praia_1.jpg'), arq('_x.jpg')]), opc())
    expect(r.itens[0].fotos).toHaveLength(2)
    expect(r.itens[0].fotosNovas).toBe(2)
    expect(r.resumo.fotos).toBe(2)
    expect(r.resumo.semItem).toEqual(['praia_1.jpg', '_x.jpg'])
  })
  test('limite de 6 fotos e 20 itens', () => {
    const fotos = Array.from({ length: 8 }, (_, i) => arq(`a_${i}.jpg`))
    const r = juntarImportacao([{ id: 'a', nome: 'A', fotos: [{ path: 'p' }] }], ent('', fotos), opc())
    expect(r.itens[0].fotos).toHaveLength(6)
    expect(r.resumo.foraFotos).toHaveLength(3)
    const lista = Array.from({ length: 22 }, (_, i) => `Item ${String.fromCharCode(65 + i)}${i}`).join('\n')
    const r2 = juntarImportacao([], ent(lista, [arq('itemv21_1.jpg')]), opc())
    expect(r2.itens).toHaveLength(20)
    expect(r2.resumo.foraItens).toHaveLength(2)
    expect(r2.resumo.novos).toBe(20)
  })
  test('importar duas vezes não duplica', () => {
    const e = ent('Gramado;2199', [arq('gramado_1.jpg')])
    const r1 = juntarImportacao([], e, opc())
    const r2 = juntarImportacao(r1.itens, e, opc())
    expect(r2.itens).toHaveLength(1)
    expect(r2.resumo.novos).toBe(0)
    expect(r2.resumo.atualizados).toBe(1)
  })
  test('noPromo ignora preços e avisa', () => {
    const r = juntarImportacao([{ id: 'a', nome: 'Gramado', precoTexto: '2000' }], ent('Gramado;2199;1799\nNovo item'), opc(true))
    expect(r.itens[0]).toMatchObject({ precoTexto: '2000', promoTexto: '' })
    expect(r.itens[1].precoTexto).toBe('')
    expect(r.resumo.precosIgnorados).toBe(true)
  })
  test('erros não criam item', () => {
    const r = juntarImportacao([], ent('x;1\nGramado'), opc())
    expect(r.itens).toHaveLength(1)
    expect(r.resumo.erros).toHaveLength(1)
  })
  test('não mexe na lista original', () => {
    const atual = [{ id: 'a', nome: 'Gramado', precoTexto: '2000', fotos: [{ path: 'p' }] }, { id: 'b', nome: 'Bonito', foto_path: 'x' }]
    const antes = structuredClone(atual)
    juntarImportacao(atual, ent('Gramado;2199\nNovo', [arq('gramado_1.jpg'), arq('bonito_1.jpg')]), opc())
    expect(atual).toEqual(antes)
  })
})
