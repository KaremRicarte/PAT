import { escolherArtes, escolherArte, FAMILIA, ehPergunta, fontesDaFamilia, montar } from '../../app/src/artes/familia.js'
import { blocosDoCarrossel, paginasDoCarrossel } from '../../app/src/artes/texto.js'

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

describe('blocosDoCarrossel (o texto da legenda nas páginas)', () => {
  test('gancho, um bloco por parágrafo do meio e o convite; a assinatura não vira página', () => {
    const legenda = 'Você dorme e acorda cansada?\n\nPrimeiro sinal.\n\nSegundo sinal.\n\nTerceiro sinal.\n\nMe chama no direct.\n\nSiga @suaPsicologa para mais conteúdo.'
    expect(blocosDoCarrossel(legenda)).toEqual({ gancho: 'Você dorme e acorda cansada?', meios: ['Primeiro sinal.', 'Segundo sinal.', 'Terceiro sinal.'], convite: 'Me chama no direct.' })
    expect(paginasDoCarrossel(legenda)).toBe(7) // capa, gancho, 3 do meio, convite, fecho
  })
  test('assinatura do Facebook também fica de fora', () => {
    expect(blocosDoCarrossel('G.\n\nM.\n\nC.\n\nPsi Marcelina · Instagram @suaPsicologa').convite).toBe('C.')
  })
  test('parágrafo longo vira duas páginas, pelas frases, sem perder texto', () => {
    const longo = Array.from({ length: 8 }, (_, i) => `Esta é a frase número ${i + 1} do parágrafo longo.`).join(' ')
    const { meios } = blocosDoCarrossel(`G.\n\n${longo}\n\nC.`)
    expect(meios.length).toBeGreaterThan(1)
    expect(meios.join(' ')).toBe(longo)
  })
  test('no máximo 8 páginas: o excesso do meio se junta, sem perder texto', () => {
    const meio = Array.from({ length: 9 }, (_, i) => `Item ${i + 1}.`)
    const b = blocosDoCarrossel(['G.', ...meio, 'C.'].join('\n\n'))
    expect(b.meios.length).toBe(4)
    expect(b.meios.join('\n').split('\n')).toEqual(meio)
    expect(paginasDoCarrossel(['G.', ...meio, 'C.'].join('\n\n'))).toBe(8)
  })
  test('legenda curta: capa, gancho e fecho', () => {
    expect(paginasDoCarrossel('Só uma frase.')).toBe(3)
    expect(paginasDoCarrossel('')).toBe(3)
  })
})

describe('montar respeita a quebra de linha (itens de lista)', () => {
  test('cada \n começa uma linha nova', () => {
    const ctx = { font: '', measureText: (s) => ({ width: s.length * 10 }) }
    const b = montar(ctx, '1. Um\n2. Dois', { tam: 40, largura: 10000, altura: 1000, fonte: () => '' })
    expect(b.linhas.map((l) => l.map((t) => t.p).join(' '))).toEqual(['1. Um', '2. Dois'])
  })
})
