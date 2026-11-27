import { pixelsDaLogoBranca } from '../../app/src/artes/logoBranca.js'

// pixels RGBA; devolve só os alfas
const alfas = (px) => [...pixelsDaLogoBranca(new Uint8ClampedArray(px.flat()))].filter((_, i) => i % 4 === 3)
const cores = (px) => [...pixelsDaLogoBranca(new Uint8ClampedArray(px.flat()))].filter((_, i) => i % 4 !== 3)

test('tudo vira branco', () => {
  expect(new Set(cores([[29, 63, 140, 255], [255, 255, 255, 255], [0, 0, 0, 0]]))).toEqual(new Set([255]))
})
test('logo colorida com texto branco: o fundo colorido vira branco opaco, o texto branco fica vazado', () => {
  const [oval, texto] = alfas([[29, 63, 140, 255], [255, 255, 255, 255]])
  expect(oval).toBe(255)
  expect(texto).toBe(0)
})
test('logo de uma cor só (sem contraste): silhueta branca, transparente onde já era', () => {
  expect(alfas([[200, 30, 30, 255], [200, 30, 30, 255], [0, 0, 0, 0]])).toEqual([255, 255, 0])
})
test('logo com fundo branco (JPG): o fundo some e o desenho escuro fica branco', () => {
  const [fundo, desenho] = alfas([[255, 255, 255, 255], [20, 20, 20, 255]])
  expect(fundo).toBe(0)
  expect(desenho).toBe(255)
})
