import { palavraDoFundo } from '../../app/src/artes/tipografica.js'
import { pecasDaArte } from '../../app/src/cliente/situacao.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'
import { LOOKS } from '../../app/src/artes/looks.js'

test('palavraDoFundo: a palavra-tema de cada tipo de post', () => {
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Qual vai ser a sua próxima viagem?' })).toBe('pergunta')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Dica: chegue 2 horas antes do voo' })).toBe('dica')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Você sabia que Gramado tem neve?' })).toBe('curiosidade')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Bastidores: como montamos o seu roteiro' })).toBe('bastidores')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Conheça a nossa equipe' })).toBe('equipe')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'A história da Malibu' })).toBe('nossa história')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Cliente feliz: a viagem da Ana' })).toBe('clientes')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Não se atrase para o embarque!' })).toBe('lembrete')
  expect(palavraDoFundo({ pilar: 'need', titulo: 'Viagem sem planejamento sai mais cara' })).toBe('atenção')
  expect(palavraDoFundo({ pilar: 'demo', titulo: 'Por que conhecer Gramado?' })).toBe('#partiu')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Um dia na agência' })).toBe('#partiu')
  // enquete do story: pergunta
  expect(palavraDoFundo({ pilar: 'demo', titulo: 'Você prefere praia ou serra' }, { enquete: true })).toBe('pergunta')
})

test('pecasDaArte: só o Turismo ganha a palavra do fundo', () => {
  const n = { nome: 'Malibu', insta: '@malibu', assinatura: 'insta' }
  const post = { titulo: 'Qual vai ser a sua próxima viagem?', pilar: 'aprox', legenda: 'a' }
  expect(pecasDaArte(post, n, RAMOS.turismo).palavra).toBe('pergunta')
  expect(pecasDaArte(post, n, RAMOS.beleza)).not.toHaveProperty('palavra')
})

// Canvas de mentira: guarda os textos pintados (com a caixa) e conta os desenhos de formas.
function canvasFalso() {
  const textos = [], caixas = []
  const tamanho = (font) => Number(/([\d.]+)px/.exec(font)[1])
  const ctx = {
    font: '10px x', textAlign: 'left', textBaseline: 'alphabetic', fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1,
    measureText(s) { return { width: s.length * tamanho(this.font) * 0.6 } },
    fillText(s, x, y, max) {
      const tam = tamanho(this.font), w = Math.min(this.measureText(s).width, max ?? Infinity)
      const esq = this.textAlign === 'center' ? x - w / 2 : this.textAlign === 'right' ? x - w : x
      const topo = this.textBaseline === 'middle' ? y - tam / 2 : this.textBaseline === 'bottom' ? y - tam : this.textBaseline === 'top' ? y : y - tam
      textos.push({ s, esq, dir: esq + w, topo, base: topo + tam })
    },
    strokeText(s, x, y, max) { this.fillText(s, x, y, max) },
    save() {}, restore() {}, clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {}, rect() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, stroke() {}, setLineDash() {}, translate() {}, scale() {}, rotate() {}, clip() {},
    roundRect(x, y, w, h) { caixas.push({ esq: x, dir: x + w, topo: y, base: y + h }) },
    fill() {}, arc() {}, drawImage() {}, createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  }
  return { ctx, textos, caixas }
}

const base = { rotulo: 'MALIBU', titulo: 'Lembrete: não se atrase para o embarque!', gancho: 'Chegue 2 horas antes.', meio: '', convite: '', assinatura: { texto: '@malibu', logo: false }, palavra: 'lembrete' }
const formas = [{ W: 1080, H: 1350, paginas: 1 }, { W: 1080, H: 1920, paginas: 1 }, { W: 1080, H: 1350, paginas: 5 }, { W: 720, H: 1280, paginas: 1, capaDeVideo: true }]

test('sem foto: arte tipográfica com a palavra repetida ao fundo e o título no balão, sem sair da arte', async () => {
  const { desenharArte } = await import('../../app/src/artes/desenho.js')
  for (const look of Object.values(LOOKS)) {
    for (const forma of formas) {
      const { ctx, textos, caixas } = canvasFalso()
      desenharArte(ctx, { pecas: base, look, cores: { cor1: '#1D4E89', cor2: '#FFFFFF' }, foto: null, logo: null, ...forma, pagina: 1, arte: 'arco' })
      expect(textos.filter((x) => x.s === 'lembrete').length).toBeGreaterThanOrEqual(3)
      const doTitulo = textos.filter((x) => base.titulo.includes(x.s) && x.s.length > 1 && x.s !== 'lembrete')
      expect(doTitulo.map((x) => x.s).join(' ')).toContain('embarque!')
      expect(caixas.length).toBeGreaterThan(0) // o balão
      for (const tx of textos) {
        expect(tx.esq).toBeGreaterThanOrEqual(0); expect(tx.dir).toBeLessThanOrEqual(forma.W)
        expect(tx.topo).toBeGreaterThanOrEqual(0); expect(tx.base).toBeLessThanOrEqual(forma.H)
      }
    }
  }
})

test('título longo cabe no balão (letra menor)', async () => {
  const { desenharArte } = await import('../../app/src/artes/desenho.js')
  const longo = 'Você sabia que dá para conhecer três países da América do Sul numa só viagem, com tudo organizado e sem correria?'
  const { ctx, textos } = canvasFalso()
  desenharArte(ctx, { pecas: { ...base, titulo: longo }, look: LOOKS.varejo, cores: { cor1: '#1D4E89', cor2: '#FFFFFF' }, foto: null, W: 1080, H: 1350, arte: 'arco' })
  const doTitulo = textos.filter((x) => longo.includes(x.s) && x.s !== 'lembrete')
  expect(doTitulo.map((x) => x.s).join(' ')).toBe(longo)
})

test('com foto ou sem a palavra (outros ramos): a arte é a de sempre', async () => {
  const { desenharArte } = await import('../../app/src/artes/desenho.js')
  const foto = { width: 100, height: 100 }
  const a = canvasFalso()
  desenharArte(a.ctx, { pecas: base, look: LOOKS.varejo, cores: { cor1: '#1D4E89', cor2: '#FFFFFF' }, foto, W: 1080, H: 1350, arte: 'arco' })
  expect(a.textos.filter((x) => x.s === 'lembrete').length).toBe(0)
  const b = canvasFalso()
  const { palavra: _p, ...semPalavra } = base
  desenharArte(b.ctx, { pecas: semPalavra, look: LOOKS.varejo, cores: { cor1: '#1D4E89', cor2: '#FFFFFF' }, foto: null, W: 1080, H: 1350, arte: 'arco' })
  expect(b.textos.filter((x) => x.s === 'lembrete').length).toBe(0)
})

test('palavraDoFundo: os temas novos do Turismo', () => {
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Checklist: o que levar na sua bagagem?' })).toBe('checklist')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: '5 destinos para viajar sem passaporte' })).toBe('lista')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Qual o peso ideal da bagagem?' })).toBe('dica')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Motivos para viajar com uma agência' })).toBe('motivos')
  expect(palavraDoFundo({ pilar: 'aprox', titulo: 'Viajou com a gente? Conta como foi!' })).toBe('clientes')
})

test('carrossel do Turismo: as páginas de dentro não desenham bolhas nem aspas; têm o texto da página e a rota', async () => {
  globalThis.Path2D ??= class {} // ícones como no navegador (sem Path2D, o ícone vira uma bolinha)
  const { desenharArte } = await import('../../app/src/artes/desenho.js')
  const pecas = { ...base, palavra: 'dica', titulo: 'Qual o peso ideal da bagagem?',
    blocos: { gancho: 'Pagar excesso de bagagem é dinheiro que podia virar passeio.', meios: ['A franquia muda conforme a companhia.', 'Pese a mala antes de sair.'], convite: 'Na dúvida, pergunta para a nossa equipe.' } }
  for (const arte of ['papel', 'arco', 'bilhete', 'cor', 'pergunta', 'horizonte', 'ondas', 'pedra', 'cartao', 'janela']) {
    for (let pagina = 2; pagina <= 5; pagina++) {
      const c = canvasFalso()
      const arcos = []
      c.ctx.arc = (...a) => arcos.push(a)
      c.ctx.quadraticCurveTo = (...a) => arcos.push(a) // as bolhas são feitas de curvas
      c.ctx.bezierCurveTo = () => {}
      desenharArte(c.ctx, { pecas, look: LOOKS.varejo, cores: { cor1: '#1D4E89', cor2: '#FFFFFF' }, foto: null, W: 1080, H: 1350, pagina, paginas: 6, arte })
      const todos = c.textos.map((x) => x.s).join(' ')
      expect(todos).not.toContain('“') // sem aspas decorativas
      expect(arcos.length).toBe(0) // sem bolhas, ondas e círculos
      if (pagina === 2) expect(todos).toContain('passeio.')
      if (pagina === 3) expect(todos).toContain('companhia.')
      for (const tx of c.textos) { expect(tx.dir).toBeLessThanOrEqual(1080); expect(tx.base).toBeLessThanOrEqual(1350) }
    }
  }
})
