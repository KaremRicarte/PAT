import { soOsNomes } from '../../app/src/artes/logoBranca.js'

// Imagem de alfas (w×h, 0 ou 255) com retângulos cheios ou vazados.
function imagem(w, h, formas) {
  const a = new Uint8ClampedArray(w * h)
  for (const { x, y, l, a: alt, vazado } of formas) {
    for (let j = y; j < y + alt; j++) {
      for (let i = x; i < x + l; i++) {
        const borda = i < x + 2 || i >= x + l - 2 || j < y + 2 || j >= y + alt - 2
        if (!vazado || borda) a[j * w + i] = 255
      }
    }
  }
  return a
}
const aceso = (a, w, x, y) => a[y * w + x] > 0
// 5 "letras" de 8×20 lado a lado (de x = 20 até 110), na altura 40
const letras = [0, 1, 2, 3, 4].map((k) => ({ x: 20 + k * 18, y: 40, l: 8, a: 20 }))

test('letras lado a lado ficam; um desenho solto ao lado sai', () => {
  const w = 220, h = 100
  const r = soOsNomes(imagem(w, h, [...letras, { x: 150, y: 20, l: 50, a: 60 }]), w, h)
  expect(aceso(r, w, 24, 50)).toBe(true)
  expect(aceso(r, w, 175, 50)).toBe(false)
})

test('a moldura em volta (contorno) sai', () => {
  const w = 220, h = 100
  const r = soOsNomes(imagem(w, h, [...letras, { x: 2, y: 2, l: 216, a: 96, vazado: true }]), w, h)
  expect(aceso(r, w, 24, 50)).toBe(true)
  expect(aceso(r, w, 3, 50)).toBe(false)
})

test('duas linhas de nome (ex.: MALIBU e TURISMO) ficam', () => {
  const w = 220, h = 120
  const linha2 = [0, 1, 2, 3].map((k) => ({ x: 30 + k * 12, y: 80, l: 6, a: 12 }))
  const r = soOsNomes(imagem(w, h, [...letras, ...linha2, { x: 160, y: 20, l: 40, a: 80 }]), w, h)
  expect(aceso(r, w, 32, 85)).toBe(true)
  expect(aceso(r, w, 24, 50)).toBe(true)
  expect(aceso(r, w, 180, 50)).toBe(false)
})

test('palavra emendada (cursiva: uma peça larga) fica', () => {
  const w = 220, h = 100
  const r = soOsNomes(imagem(w, h, [{ x: 20, y: 40, l: 100, a: 20 }, { x: 150, y: 20, l: 50, a: 60 }]), w, h)
  expect(aceso(r, w, 60, 50)).toBe(true)
  expect(aceso(r, w, 175, 50)).toBe(false)
})

test('logo só com um ícone (sem nome): fica inteira', () => {
  const w = 120, h = 100
  const r = soOsNomes(imagem(w, h, [{ x: 30, y: 20, l: 50, a: 60 }]), w, h)
  expect(aceso(r, w, 50, 50)).toBe(true)
})

test('acentos e pingos (peças pequenas) junto do nome ficam', () => {
  const w = 220, h = 100
  const r = soOsNomes(imagem(w, h, [...letras, { x: 21, y: 34, l: 3, a: 3 }, { x: 150, y: 20, l: 50, a: 60 }]), w, h)
  expect(aceso(r, w, 22, 35)).toBe(true)
})

test('caixaVisivel: a caixa em volta do que ficou visível', async () => {
  const { caixaVisivel } = await import('../../app/src/artes/logoBranca.js')
  const w = 6, h = 4, px = new Uint8ClampedArray(w * h * 4)
  for (const [x, y] of [[2, 1], [4, 2]]) px[(y * w + x) * 4 + 3] = 255
  expect(caixaVisivel(px, w, h)).toEqual({ x: 2, y: 1, w: 3, h: 2 })
  expect(caixaVisivel(new Uint8ClampedArray(w * h * 4), w, h)).toBe(null)
})
