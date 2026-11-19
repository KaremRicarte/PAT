import { paletaDaArte, contraste } from '../../app/src/artes/familia.js'

test('cores do cliente em qualquer ordem: destaque vivo e tinta escura que lê bem', () => {
  // Malibu: azul + cinza-claro (a cor 2 clara virava a cor do texto)
  const m = paletaDaArte('#0056d6', '#ebebeb')
  expect(m.c1).toBe('#0056d6')
  expect(contraste(m.c2, '#ffffff')).toBeGreaterThanOrEqual(7)
  expect(contraste(m.c2, m.c1)).toBeGreaterThanOrEqual(2.5)
  // Salão da Edna: rosa + creme
  const e = paletaDaArte('#B76E79', '#F6EFEA')
  expect(e.c1).toBe('#B76E79')
  expect(contraste(e.c2, '#ffffff')).toBeGreaterThanOrEqual(7)
})
test('quem já tem uma cor escura própria fica igual', () => {
  expect(paletaDaArte('#F2A21B', '#151925')).toEqual({ c1: '#F2A21B', c2: '#151925' })
  expect(paletaDaArte('#e3cae1', '#535256')).toEqual({ c1: '#e3cae1', c2: '#535256' })
})
