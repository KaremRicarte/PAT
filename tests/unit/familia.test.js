import { escolherArtes, escolherArte, FAMILIA, ehPergunta, fontesDaFamilia, montar } from '../../app/src/artes/familia.js'

const tom = (id) => FAMILIA.find((f) => f.id === id).tom
const posts = (n, extra = () => ({})) => Array.from({ length: n }, (_, i) => ({
  id: `p${i}`, titulo: `Título ${i}`, rede: 'instagram', tipo: 'feed', data: `2026-12-${String(i + 1).padStart(2, '0')}`, ordem: 0, ...extra(i),
}))

describe('escolherArtes', () => {
  const seq = posts(30)
  const artes = escolherArtes(seq).map((f) => f.id)

  test('nunca repete nenhuma das 3 artes anteriores', () => {
    artes.forEach((a, i) => expect(artes.slice(Math.max(0, i - 3), i)).not.toContain(a))
  })
  test('nunca põe 3 do mesmo tom seguidos', () => {
    for (let i = 2; i < artes.length; i++) {
      expect(tom(artes[i]) === tom(artes[i - 1]) && tom(artes[i]) === tom(artes[i - 2])).toBe(false)
    }
  })
  test('usa bastante variedade: num mês de 30 posts, pelo menos 7 artes diferentes', () => {
    expect(new Set(artes).size).toBeGreaterThanOrEqual(7)
  })
  test('"pergunta" só em títulos com "?"', () => {
    const mistos = posts(40, (i) => ({ titulo: i % 3 === 0 ? `Você já pensou nisso ${i}?` : `Frase ${i}` }))
    escolherArtes(mistos).forEach((f, i) => { if (f.soPergunta) expect(ehPergunta(mistos[i].titulo)).toBe(true) })
    expect(escolherArtes(mistos).some((f) => f.id === 'pergunta')).toBe(true)
  })
  test('é estável: o mesmo mês dá sempre as mesmas artes', () => {
    expect(escolherArtes(seq).map((f) => f.id)).toEqual(artes)
  })
})

describe('escolherArte (um post entre os do mês)', () => {
  const mes = [...posts(8), ...posts(4, (i) => ({ id: `s${i}`, tipo: 'stories' })), ...posts(3, (i) => ({ id: `f${i}`, rede: 'facebook' }))]
  test('a arte de um post é a mesma da sequência da grade dele (feed da mesma rede, em ordem de data)', () => {
    const grade = mes.filter((p) => p.rede === 'instagram' && p.tipo === 'feed')
    const esperadas = escolherArtes(grade).map((f) => f.id)
    grade.forEach((p, i) => expect(escolherArte(p, [...mes].reverse()).id).toBe(esperadas[i]))
  })
  test('stories formam uma sequência separada do feed', () => {
    const st = mes.filter((p) => p.tipo === 'stories')
    expect(escolherArte(st[2], mes).id).toBe(escolherArtes(st)[2].id)
  })
  test('sem os posts do mês, escolhe só pelo próprio post', () => {
    expect(FAMILIA.map((f) => f.id)).toContain(escolherArte(mes[0]).id)
  })
})

describe('fontes e texto', () => {
  test('cada estilo carrega as fontes da própria voz; o varejo não pede itálico', () => {
    expect(fontesDaFamilia('sereno').some((f) => f.includes('italic') && f.includes('Fraunces'))).toBe(true)
    expect(fontesDaFamilia('varejo').some((f) => f.includes('italic'))).toBe(false)
    expect(fontesDaFamilia('elegante').join()).toContain('Cormorant Garamond')
  })
  test('montar encolhe até caber e, se não couber nem no mínimo, corta com reticências', () => {
    const ctx = { font: '', measureText: (s) => ({ width: s.length * 10 }) } // 10 px por letra em qualquer tamanho
    const cabe = montar(ctx, 'uma frase curta', { tam: 40, largura: 1000, altura: 100, fonte: () => '' })
    expect(cabe.linhas.length).toBe(1)
    const longo = montar(ctx, 'palavra '.repeat(40), { tam: 40, largura: 100, altura: 60, fonte: () => '' })
    expect(longo.h).toBeLessThanOrEqual(60 + 1e-9)
    expect(longo.linhas.at(-1).at(-1).p.endsWith('…')).toBe(true)
  })
})
