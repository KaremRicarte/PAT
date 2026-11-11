import { lookDoRamo, LOOKS } from '../../app/src/artes/looks.js'
import { corTexto, quebrarLinhas, medidaDaArte, contrasteBom, encaixarTexto, assinaturaDaArte } from '../../app/src/artes/texto.js'

const medir = (s) => s.length

test('quebrarLinhas quebra nas palavras sem passar da largura', () => {
  expect(quebrarLinhas('Furadeira de impacto profissional', 10, medir)).toEqual(['Furadeira', 'de impacto', 'profissional'])
  expect(quebrarLinhas('  a   b  ', 10, medir)).toEqual(['a b'])
  expect(quebrarLinhas('', 10, medir)).toEqual([])
})

test('quebrarLinhas: palavra maior que a largura fica sozinha na linha', () => {
  expect(quebrarLinhas('oi supercalifragilístico tchau', 6, medir)).toEqual(['oi', 'supercalifragilístico', 'tchau'])
})

test('lookDoRamo: fontes de cada estilo; ramos sem estilo próprio usam varejo', () => {
  expect(lookDoRamo('advocacia').fd).toContain('Playfair Display')
  expect(lookDoRamo('beleza')).toBe(LOOKS.elegante)
  expect(lookDoRamo('psicologia')).toBe(LOOKS.sereno)
  expect(lookDoRamo('turismo')).toEqual(LOOKS.varejo)
  expect(lookDoRamo('ferramentas')).toEqual(LOOKS.varejo)
  expect(lookDoRamo(undefined)).toEqual(LOOKS.varejo)
  expect(LOOKS.elegante.center).toBe(true)
  expect(LOOKS.varejo.box).toBe(true)
})

test('corTexto: texto escuro em cor clara e branco em cor escura', () => {
  expect(corTexto('#CEFB14')).toBe('#111111')
  expect(corTexto('#151925')).toBe('#FFFFFF')
  expect(corTexto('#FFFFFF')).toBe('#111111')
  expect(corTexto('lixo')).toBe('#FFFFFF')
})

test('contrasteBom: cor principal sobre o fundo só com contraste de 3:1', () => {
  expect(contrasteBom('#1D4E89', '#FFFFFF')).toBe(true)
  expect(contrasteBom('#F3EBDD', '#FFFFFF')).toBe(false)
})

test('medidaDaArte para cada tipo de post', () => {
  expect(medidaDaArte({ tipo: 'feed', formato: 'arte' })).toEqual({ W: 1080, H: 1350, paginas: 1 })
  expect(medidaDaArte({ tipo: 'feed', formato: 'carrossel' })).toEqual({ W: 1080, H: 1350, paginas: 5 })
  expect(medidaDaArte({ tipo: 'stories', formato: 'arte' })).toEqual({ W: 1080, H: 1920, paginas: 1 })
  expect(medidaDaArte({ tipo: 'status', formato: 'arte' })).toEqual({ W: 1080, H: 1920, paginas: 1 })
  expect(medidaDaArte({ tipo: 'video', formato: 'gravar' })).toEqual({ W: 720, H: 1280, paginas: 1 })
  expect(medidaDaArte({ tipo: 'video', formato: 'montagem' })).toEqual({ W: 720, H: 1280, paginas: 1 })
  expect(medidaDaArte({ tipo: 'lista', formato: 'texto' })).toBeNull()
})

test('encaixarTexto: diminui a letra até caber e, no limite, corta com reticências', () => {
  // altura = linhas × tamanho; largura medida em caracteres × tamanho
  const quebra = (t, tam) => quebrarLinhas(t, 20, (s) => s.length * tam / 10)
  const r1 = encaixarTexto('curto', { tamanho: 10, minimo: 5, alturaMax: 100, quebra, altura: (n, tam) => n * tam })
  expect(r1).toEqual({ tamanho: 10, linhas: ['curto'] })

  const longo = 'uma frase bem comprida que não cabe numa linha só de jeito nenhum'
  const r2 = encaixarTexto(longo, { tamanho: 10, minimo: 5, alturaMax: 30, quebra, altura: (n, tam) => n * tam })
  expect(r2.tamanho).toBeLessThan(10)
  expect(r2.linhas.length * r2.tamanho).toBeLessThanOrEqual(30)

  const r3 = encaixarTexto(longo, { tamanho: 10, minimo: 9, alturaMax: 20, quebra, altura: (n, tam) => n * tam })
  expect(r3.tamanho).toBe(9)
  expect(r3.linhas.length).toBe(2)
  expect(r3.linhas[1].endsWith('…')).toBe(true)
  for (const l of r3.linhas) expect(l.length * 9 / 10).toBeLessThanOrEqual(20)
})

test('assinaturaDaArte: @ do Instagram com arroba; sem logo nem @, entra o nome do negócio', () => {
  expect(assinaturaDaArte({ texto: 'loja.x', logo: true }, true, 'Loja X')).toEqual({ texto: '@loja.x', logo: true })
  expect(assinaturaDaArte({ texto: '@loja.x', logo: false }, true, 'Loja X')).toEqual({ texto: '@loja.x', logo: false })
  expect(assinaturaDaArte({ texto: null, logo: true }, true, 'Loja X')).toEqual({ texto: null, logo: true })
  expect(assinaturaDaArte({ texto: null, logo: true }, false, 'Loja X')).toEqual({ texto: 'Loja X', logo: false })
  expect(assinaturaDaArte({ texto: null, logo: false }, true, 'Loja X')).toEqual({ texto: 'Loja X', logo: false })
})

// Canvas de mentira: guarda cada texto pintado com a caixa que ele ocupa.
function canvasFalso() {
  const textos = [], caixas = []
  const tamanho = (font) => Number(/([\d.]+)px/.exec(font)[1])
  const ctx = {
    font: '10px x', textAlign: 'left', textBaseline: 'alphabetic', fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1,
    measureText(s) { return { width: s.length * tamanho(this.font) * 0.6 } },
    fillText(s, x, y, max) {
      const tam = tamanho(this.font), w = Math.min(this.measureText(s).width, max ?? Infinity)
      const esq = this.textAlign === 'center' ? x - w / 2 : this.textAlign === 'right' ? x - w : x
      const topo = this.textBaseline === 'middle' ? y - tam / 2 : this.textBaseline === 'bottom' ? y - tam : y
      textos.push({ s, esq, dir: esq + w, topo, base: topo + tam })
    },
    save() {}, restore() {}, clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {}, rect() {},
    roundRect(x, y, w, h) { caixas.push({ esq: x, dir: x + w, topo: y, base: y + h }) },
    fill() {}, arc() {}, drawImage() {}, createLinearGradient: () => ({ addColorStop() {} }),
  }
  return { ctx, textos, caixas }
}

test('desenharArte: nenhum texto sai da arte, em todos os estilos e formas, com textos longos', async () => {
  const { desenharArte } = await import('../../app/src/artes/desenho.js')
  const longo = 'Você já perdeu um dia inteiro de obra porque a ferramenta não deu conta do concreto? A gente sabe como isso atrasa tudo e encarece o serviço no fim do mês.'
  const palavra = 'Anticonstitucionalissimam' // 25 letras
  const pecas = {
    rotulo: 'FERRAGENS E MATERIAIS DE CONSTRUÇÃO SÃO JOÃO DA BOA VISTA', titulo: `${palavra} ${longo}`, gancho: `O ${palavra} ${longo}`, meio: longo + ' ' + longo, convite: longo,
    assinatura: { texto: '@lojadoteste', logo: false },
  }
  const formas = [
    { W: 1080, H: 1350, paginas: 1 }, { W: 1080, H: 1350, paginas: 5 }, { W: 1080, H: 1920, paginas: 1 }, { W: 720, H: 1280, paginas: 1, capaDeVideo: true },
  ]
  for (const look of Object.values(LOOKS)) {
    for (const forma of formas) {
      for (let pagina = 1; pagina <= forma.paginas; pagina++) {
        const { ctx, textos, caixas } = canvasFalso()
        desenharArte(ctx, { pecas, look, cores: { cor1: '#1D4E89', cor2: '#FFFFFF' }, foto: null, logo: null, ...forma, pagina })
        expect(textos.length).toBeGreaterThan(0)
        for (const tx of [...textos, ...caixas]) {
          expect(tx.esq).toBeGreaterThanOrEqual(0)
          expect(tx.dir).toBeLessThanOrEqual(forma.W)
          expect(tx.topo).toBeGreaterThanOrEqual(0)
          expect(tx.base).toBeLessThanOrEqual(forma.H)
        }
      }
    }
  }
})

test('encaixarTexto: linha mais larga que o máximo também conta como "não coube"', () => {
  const quebra = (t, tam) => quebrarLinhas(t, 20, (s) => s.length * tam / 10)
  const r = encaixarTexto('oi Anticonstitucionalissimam', {
    tamanho: 10, minimo: 5, alturaMax: 1000, quebra, altura: (n, tam) => n * tam,
    larguraMax: 20, largura: (s, tam) => s.length * tam / 10,
  })
  expect(r.tamanho).toBeLessThan(10)
  for (const l of r.linhas) expect(l.length * r.tamanho / 10).toBeLessThanOrEqual(20)
})
