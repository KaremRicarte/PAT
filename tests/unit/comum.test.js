import { filhosValidos } from '../../app/src/comum.js'

describe('filhosValidos', () => {
  it('achata listas e descarta vazios (null, undefined, false)', () => {
    const a = { n: 'a' }, b = { n: 'b' }, c = { n: 'c' }
    expect(filhosValidos([a, null, [b, [c, undefined]], false])).toEqual([a, b, c])
  })

  it('mantém textos e o zero', () => {
    expect(filhosValidos(['oi', 0, ''])).toEqual(['oi', 0, ''])
  })
})
