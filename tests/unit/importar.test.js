import { normalizarNome, chaveDaFoto, decodificarTexto, lerLista } from '../../app/src/cliente/importar.js'

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
    const r = lerLista('# comentário\n\n  \nX;10;')
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0]).toMatchObject({ preco: 10, promo: undefined })
  })
  test('formato brasileiro e separadores', () => {
    expect(lerLista('AB;R$ 2.199,90;1.999,90').linhas[0]).toMatchObject({ preco: 2199.9, promo: 1999.9 })
    expect(lerLista('Gramado,2199,1799').linhas[0]).toMatchObject({ nome: 'Gramado', preco: 2199, promo: 1799 })
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
