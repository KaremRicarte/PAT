// A cara das datas especiais nas artes: as cores da data (Black Friday em preto, Natal em vermelho e verde...)
// e, no feed, uma faixa no alto com o nome da data e um enfeite (estrelas, brilhos, confete, corações, bandeirinhas).
// Vale para os posts com ocasião (o post do dia de uma data, ou o aquecimento/dia de uma promoção com data).
import { paletaDaArte, contraste, misturar } from './familia.js'

// Black Friday: tudo preto, texto branco; a cor viva do cliente só nos detalhes. Nas artes de preço (desenho.js),
// as tarjas do título e o selo ficam pretos.
const BLACK = { cor2: '#000000', papel: '#111111', claro: '#FFFFFF', tinta: '#FFFFFF', faixa: '#000000', letra: '#FFFFFF', enfeite: 'linha', preto: true }
const VIRADA = { cor1: '#C9A227', cor2: '#0B1426', papel: '#F6F1E3', claro: '#F2E3B3', faixa: '#0B1426', letra: '#E9C46A', enfeite: 'brilhos', brilho: '#E9C46A' }

// cor1 ausente = fica a cor de destaque do cliente (a marca aparece; a data dá o resto)
export const TEMAS = Object.freeze({
  'Black Friday': BLACK,
  'Dia do Consumidor': BLACK,
  'Natal': { cor1: '#B3121F', cor2: '#0E3B2E', papel: '#F7F1E5', claro: '#F3E2B3', faixa: '#B3121F', letra: '#FFF6E0', enfeite: 'estrelas', brilho: '#E9C46A' },
  'Réveillon': VIRADA,
  'Ano Novo': VIRADA,
  'Carnaval': { cor1: '#E5097F', cor2: '#2A0E5C', papel: '#FFF4FA', claro: '#FFD6EC', faixa: '#2A0E5C', letra: '#FFFFFF', enfeite: 'confete' },
  'Dia Internacional da Mulher': { cor1: '#8E44AD', cor2: '#2E0F3D', papel: '#F7F0FA', claro: '#EBD7F3', faixa: '#8E44AD', letra: '#FFFFFF' },
  'Páscoa': { cor1: '#D9822B', cor2: '#3B2414', papel: '#FBF3E8', claro: '#F6DDBE', faixa: '#3B2414', letra: '#F6DDBE' },
  'Dia das Mães': { cor1: '#C2185B', cor2: '#3D0E22', papel: '#FCF0F4', claro: '#F6CFDD', faixa: '#C2185B', letra: '#FFFFFF', enfeite: 'coracoes' },
  'Dia dos Namorados': { cor1: '#D7263D', cor2: '#3B0A14', papel: '#FDF0F1', claro: '#F8CDD3', faixa: '#D7263D', letra: '#FFFFFF', enfeite: 'coracoes' },
  'São João': { cor1: '#E8590C', cor2: '#3E2410', papel: '#FBF1E4', claro: '#F7D9B5', faixa: '#3E2410', letra: '#F7D9B5', enfeite: 'bandeirinhas' },
  'Dia dos Pais': { cor1: '#1F6FB2', cor2: '#0F1E33', papel: '#EEF4FA', claro: '#CFE0F1', faixa: '#0F1E33', letra: '#CFE0F1' },
  'Dia das Crianças': { cor1: '#FFB400', cor2: '#1B3A8C', papel: '#FFF8E6', claro: '#FFE7A6', faixa: '#1B3A8C', letra: '#FFE7A6', enfeite: 'confete' },
  'Setembro Amarelo': { cor1: '#F2C200', cor2: '#2B2B2B', papel: '#FFF9E0', claro: '#FBEBA0', faixa: '#F2C200', letra: '#2B2B2B' },
  'Janeiro Branco': { cor1: '#8FA9BF', cor2: '#23313F', papel: '#F7F9FB', claro: '#DCE5EE', faixa: '#23313F', letra: '#FFFFFF' },
})

const valida = (o) => o && typeof o === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(o.data ?? '') && ['tema', 'aquecimento', 'dia'].includes(o.fase)

// As cores da arte para o post: as da data, se ela tiver tema; senão, as do cliente.
// fixas: as cores da data já vêm nos papéis certos (a arte não reorganiza).
export function coresDaData(cores, ocasiao) {
  const tema = valida(ocasiao) && ocasiao.nome ? TEMAS[ocasiao.nome] : null
  if (!tema) return cores
  let cor1 = tema.cor1
  if (!cor1) {
    // a cor viva do cliente como destaque; se ela não aparecer sobre o preto, um amarelo de oferta
    cor1 = paletaDaArte(cores.cor1, cores.cor2).c1
    if (contraste(cor1, tema.cor2) < 3) cor1 = '#FFC400'
  }
  const cores2 = { cor1, cor2: tema.cor2, papel: tema.papel, claro: tema.claro, fixas: true }
  if (!tema.preto) return cores2
  // destaque das palavras sobre o preto: a cor do cliente, clareada se precisar para ler bem
  const destaque = contraste(cor1, tema.papel) >= 4.5 ? cor1 : misturar(cor1, '#ffffff', 0.45)
  return { ...cores2, tinta: tema.tinta, destaque, precos: { cor1: '#000000', cor2: cor1 } }
}

const dd = (data) => `${data.slice(8, 10)}/${data.slice(5, 7)}`
// O texto da faixa: "NATAL", "VEM AÍ · BLACK FRIDAY · 27/11", "BLACK FRIDAY · SÓ HOJE", "OFERTA · 12/12".
export function textoDaFaixa(o) {
  const nome = (o.nome ?? 'Oferta').toUpperCase()
  if (o.fase === 'aquecimento') return `VEM AÍ · ${nome} · ${dd(o.data)}`
  if (o.fase === 'dia') return o.nome ? `${nome} · SÓ HOJE` : `${nome} · ${dd(o.data)}`
  return nome
}

const estrela = (ctx, x, y, r, pontas = 5, dentro = 0.45) => {
  ctx.beginPath()
  for (let i = 0; i < pontas * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / pontas, rr = i % 2 ? r * dentro : r
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath(); ctx.fill()
}
const coracao = (ctx, x, y, r) => {
  ctx.beginPath(); ctx.moveTo(x, y + r * 0.9)
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35)
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9)
  ctx.fill()
}

// A faixa no alto do feed (só arte única de feed: nos stories o Instagram cobre o alto; no carrossel há a numeração).
export function faixaDaData(ctx, { W, ocasiao, cores }) {
  const tema = valida(ocasiao) ? (ocasiao.nome ? TEMAS[ocasiao.nome] : null) : null
  if (!valida(ocasiao)) return
  const u = W / 100, h = 6.4 * u
  const fundo = tema?.faixa ?? cores.cor1 ?? '#111111'
  const letra = tema?.letra ?? (contraste(fundo, '#ffffff') >= 3 ? '#ffffff' : '#111111')
  ctx.save()
  ctx.fillStyle = fundo; ctx.fillRect(0, 0, W, h)
  // enfeites nas pontas, longe do texto do meio
  const pontas = [[4 * u, 12 * u], [W - 12 * u, W - 4 * u]]
  const enfeite = tema?.enfeite
  if (enfeite === 'linha') { ctx.fillStyle = cores.cor1 ?? '#FFC400'; ctx.fillRect(0, h, W, 0.6 * u) }
  for (const [a, b] of enfeite && enfeite !== 'linha' ? pontas : []) {
    for (let i = 0; i < 4; i++) {
      const x = a + (b - a) * (i / 3), y = h / 2 + (i % 2 ? 1 : -1) * 0.9 * u
      if (enfeite === 'estrelas') { ctx.fillStyle = tema.brilho; estrela(ctx, x, y, (i % 2 ? 1.1 : 1.6) * u) }
      else if (enfeite === 'brilhos') { ctx.fillStyle = tema.brilho; estrela(ctx, x, y, (i % 2 ? 1.0 : 1.7) * u, 4, 0.28) }
      else if (enfeite === 'coracoes') { ctx.fillStyle = tema.letra; coracao(ctx, x, y, (i % 2 ? 0.9 : 1.2) * u) }
      else if (enfeite === 'confete') {
        ctx.fillStyle = ['#FFD23F', '#3BCEAC', '#EE4266', '#FFFFFF'][i]
        ctx.save(); ctx.translate(x, y); ctx.rotate(i * 0.7); ctx.fillRect(-0.9 * u, -0.45 * u, 1.8 * u, 0.9 * u); ctx.restore()
      } else if (enfeite === 'bandeirinhas') {
        ctx.fillStyle = ['#F2C200', '#E8590C', '#2A9D8F', '#D7263D'][i]
        const bx = a + (b - a) * (i / 3)
        ctx.beginPath(); ctx.moveTo(bx - 1.2 * u, 0.8 * u); ctx.lineTo(bx + 1.2 * u, 0.8 * u); ctx.lineTo(bx, h - 1.2 * u); ctx.closePath(); ctx.fill()
      }
    }
  }
  ctx.font = `800 ${2.5 * u}px "Montserrat","Nunito Sans","DM Sans","Segoe UI",sans-serif`
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${0.35 * u}px`
  ctx.fillStyle = letra; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(textoDaFaixa(ocasiao), W / 2, h / 2 + 0.1 * u, W - 36 * u)
  ctx.restore()
}
