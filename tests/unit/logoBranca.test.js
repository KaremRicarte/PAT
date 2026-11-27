import { pixelsDaLogoBranca } from '../../app/src/artes/logoBranca.js'

// Imagem de w×h pixels RGBA (linhas de cima para baixo). Devolve os alfas da logo branca.
const alfas = (linhas) => {
  const w = linhas[0].length, h = linhas.length
  const saida = pixelsDaLogoBranca(new Uint8ClampedArray(linhas.flat(2)), w, h)
  return [...saida].filter((_, i) => i % 4 === 3)
}
const T = [0, 0, 0, 0], AZUL = [29, 63, 140, 255], BRANCO = [255, 255, 255, 255], PRETO = [10, 10, 10, 255], VERMELHO = [200, 30, 30, 255]

test('tudo vira branco', () => {
  const saida = pixelsDaLogoBranca(new Uint8ClampedArray([...AZUL, ...BRANCO, ...T, ...PRETO]), 2, 2)
  expect(new Set([...saida].filter((_, i) => i % 4 !== 3))).toEqual(new Set([255]))
})
test('nome claro dentro de uma forma colorida (fundo transparente, como o oval da Malibu): só o nome fica, opaco', () => {
  const a = alfas([[T, T, T, T], [T, AZUL, BRANCO, T], [T, AZUL, BRANCO, T], [T, T, T, T]])
  expect([a[5], a[6]]).toEqual([0, 255]) // o azul some, o branco fica
})
test('logo de uma cor só em fundo transparente: silhueta branca', () => {
  const a = alfas([[T, T, T], [T, VERMELHO, T], [T, T, T]])
  expect(a).toEqual([0, 0, 0, 0, 255, 0, 0, 0, 0])
})
test('logo com fundo branco (JPG): o fundo some e o desenho fica', () => {
  const a = alfas([[BRANCO, BRANCO, BRANCO], [BRANCO, PRETO, BRANCO], [BRANCO, BRANCO, BRANCO]])
  expect(a).toEqual([0, 0, 0, 0, 255, 0, 0, 0, 0])
})
test('logo com fundo escuro: o fundo some e o desenho claro fica', () => {
  const a = alfas([[PRETO, PRETO, PRETO], [PRETO, BRANCO, PRETO], [PRETO, PRETO, PRETO]])
  expect(a).toEqual([0, 0, 0, 0, 255, 0, 0, 0, 0])
})
test('logo colorida sem partes brancas em fundo transparente (ex.: ícone azul e texto preto): silhueta inteira', () => {
  const a = alfas([[T, T, T, T], [T, AZUL, PRETO, T], [T, T, T, T]])
  expect([a[5], a[6]]).toEqual([255, 255])
})

test('nome branco numa forma colorida com faixas claras (turquesa): só o branco de verdade fica', () => {
  const TURQUESA = [24, 224, 200, 255]
  const a = alfas([[T, T, T, T, T], [T, AZUL, TURQUESA, BRANCO, T], [T, T, T, T, T]])
  expect([a[6], a[7], a[8]]).toEqual([0, 0, 255])
})
