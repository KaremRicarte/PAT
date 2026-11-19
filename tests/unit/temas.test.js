import { coresDaData, textoDaFaixa, faixaDaData } from '../../app/src/artes/temas.js'
import { contraste } from '../../app/src/artes/familia.js'

const MALIBU = { cor1: '#0056d6', cor2: '#ebebeb' }
const oc = (nome, fase = 'tema', data = '2026-11-27') => ({ nome, data, fase })

test('Black Friday: fundo preto e o destaque é a cor viva do cliente (ou amarelo, se ela sumir no preto)', () => {
  const c = coresDaData(MALIBU, oc('Black Friday', 'aquecimento'))
  expect(c).toMatchObject({ cor1: '#0056d6', cor2: '#000000', papel: '#111111', tinta: '#FFFFFF', fixas: true, precos: { cor1: '#000000' } })
  expect(coresDaData({ cor1: '#151925', cor2: '#1a1a1a' }, oc('Black Friday')).cor1).toBe('#FFC400')
})
test('Natal: vermelho, verde e creme; sem data ou data sem tema: as cores do cliente', () => {
  expect(coresDaData(MALIBU, oc('Natal', 'tema', '2026-12-25'))).toMatchObject({ cor1: '#B3121F', cor2: '#0E3B2E', papel: '#F7F1E5' })
  expect(coresDaData(MALIBU, null)).toBe(MALIBU)
  expect(coresDaData(MALIBU, oc('Dia do Cliente', 'tema', '2026-09-15'))).toBe(MALIBU)
  expect(coresDaData(MALIBU, { nome: 'Natal', fase: 'x', data: '2026-12-25' })).toBe(MALIBU)
})
test('texto da faixa', () => {
  expect(textoDaFaixa(oc('Black Friday', 'aquecimento'))).toBe('VEM AÍ · BLACK FRIDAY · 27/11')
  expect(textoDaFaixa(oc('Black Friday', 'dia'))).toBe('BLACK FRIDAY · SÓ HOJE')
  expect(textoDaFaixa(oc('Natal', 'tema', '2026-12-25'))).toBe('NATAL')
  expect(textoDaFaixa({ nome: null, data: '2026-12-12', fase: 'dia' })).toBe('OFERTA · 12/12')
})
test('a faixa fica no alto (até 7% da largura) e a letra contrasta com ela', () => {
  const pintados = []
  const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, bezierCurveTo() {}, translate() {}, rotate() {},
    fillRect(x, y, w, h) { pintados.push({ y, h, cor: this.fillStyle }) }, fillText(s) { pintados.push({ texto: s, cor: this.fillStyle }) } }
  faixaDaData(ctx, { W: 1080, ocasiao: oc('Natal', 'dia', '2026-12-25'), cores: MALIBU })
  const retangulos = pintados.filter((p) => p.h != null)
  expect(Math.max(...retangulos.map((p) => p.y + p.h))).toBeLessThanOrEqual(1080 * 0.07)
  const texto = pintados.find((p) => p.texto)
  expect(texto.texto).toBe('NATAL · SÓ HOJE')
  expect(contraste(texto.cor, retangulos[0].cor)).toBeGreaterThanOrEqual(4.5)
})
