// Desenho das artes no canvas: a composição do v1 (drawSingle, drawSlide em bancada/index.html),
// com parâmetros explícitos no lugar das variáveis globais. Os cálculos ficam em texto.js.
import { LOOKS } from './looks.js'
import { corTexto, contrasteBom, quebrarLinhas, encaixarTexto } from './texto.js'
import { t } from '../textos.js'
import { desenharDaFamilia, marcaDagua } from './familia.js'
import { logoNaCor } from './logoBranca.js'
import { faixaDaData } from './temas.js'

// ---------- peças básicas ----------

function retanguloArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}

const dimensoes = (img) => [img.videoWidth || img.naturalWidth || img.width, img.videoHeight || img.naturalHeight || img.height]

// A imagem cobre toda a arte, cortando o que sobra (como object-fit: cover).
export function cobrir(ctx, img, W, H, zoom = 1, px = 0, py = 0) {
  if (!img) return
  const [iw, ih] = dimensoes(img)
  if (!iw || !ih) return
  const s = Math.max(W / iw, H / ih) * zoom, w = iw * s, h = ih * s
  ctx.drawImage(img, (W - w) / 2 + px * W, (H - h) / 2 + py * H, w, h)
}

// Escurece o alto e o pé da foto para o texto branco aparecer.
export function sombrear(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,.45)')
  g.addColorStop(0.38, 'rgba(0,0,0,0)')
  g.addColorStop(0.5, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,.78)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

const nomeDoEstilo = (look) => Object.keys(LOOKS).find((k) => LOOKS[k].fd === look.fd) ?? 'varejo'

// Tudo o que as funções abaixo precisam saber sobre a arte que está sendo desenhada.
export function folha(ctx, { look, cores, W, H }) {
  const u = W / 100
  return {
    ctx, look, W, H, u,
    estilo: nomeDoEstilo(look),
    b1: cores.cor1, b1i: corTexto(cores.cor1), b2: cores.cor2, b2i: corTexto(cores.cor2),
    corOk: contrasteBom(cores.cor1, cores.cor2),
    x: 8 * u, mw: W - 16 * u,
    alinhar: look.center ? 'center' : 'left',
  }
}

const medidor = (ctx) => (s) => ctx.measureText(s).width
// Largura de uma linha na fonte montada por `fonte(tam)`, para o encaixe conferir a largura.
const larguraNa = (ctx, fonte, extra = 0) => (l, tam) => { ctx.font = fonte(tam); return ctx.measureText(l).width + extra * tam }
const xAlinhado = (x, mw, alinhar) => (alinhar === 'center' ? x + mw / 2 : x)

// ---------- textos ----------

// Rótulo pequeno em caixa alta no alto da arte (label). Diminui se não couber na largura.
export function rotulo(f, texto, y, cor, { realce = true } = {}) {
  const { ctx, u, x, mw, look } = f
  if (realce && f.estilo === 'sobrio' && f.corOk) cor = f.b1 // advocacia: rótulo na cor principal, como num papel timbrado
  const txt = String(texto ?? '').toUpperCase()
  ctx.save()
  let tam = 4.4 * u
  const fonte = () => { ctx.font = `800 ${tam}px ${look.fb}`; if ('letterSpacing' in ctx) ctx.letterSpacing = `${tam * 0.06}px` }
  fonte()
  const w = ctx.measureText(txt).width
  if (w > mw) { tam = Math.max(2.8 * u, tam * mw / w); fonte() }
  ctx.globalAlpha = 0.85
  ctx.fillStyle = cor
  ctx.textBaseline = 'top'
  ctx.textAlign = look.center ? 'center' : 'left'
  ctx.fillText(txt, look.center ? x + mw / 2 : x, y, mw)
  ctx.restore()
}

// Título (hl). No varejo, cada linha numa tarja na cor principal; nos outros estilos,
// um fio curto na cor principal e o texto na cor do fundo. Encolhe até caber em alturaMax.
export function montarTitulo(f, texto, tamanho, alturaMax) {
  const { ctx, look, mw } = f
  if (!look.box) {
    const fio = (s) => 4.2 * (s / look.hs) / 9.5
    const quebra = (txt, s) => { ctx.font = `${look.dw} ${s}px ${look.fd}`; return quebrarLinhas(txt, mw, medidor(ctx)) }
    const r = encaixarTexto(texto, {
      tamanho: tamanho * look.hs, minimo: tamanho * look.hs * 0.55, alturaMax,
      quebra, altura: (n, s) => fio(s) + n * s * 1.12,
      larguraMax: mw, largura: larguraNa(ctx, (s) => `${look.dw} ${s}px ${look.fd}`),
    })
    return { ...r, h: fio(r.tamanho) + r.linhas.length * r.tamanho * 1.12 }
  }
  const quebra = (txt, s) => { ctx.font = `800 ${s}px ${look.fd}`; return quebrarLinhas(txt, mw - s * 0.44, medidor(ctx)) }
  const r = encaixarTexto(texto, {
    tamanho, minimo: tamanho * 0.55, alturaMax, quebra, altura: (n, s) => n * s * 1.25,
    larguraMax: mw, largura: larguraNa(ctx, (s) => `800 ${s}px ${look.fd}`, 0.44),
  })
  return { ...r, h: r.linhas.length * r.tamanho * 1.25 }
}

export function pintarTitulo(f, titulo, y, corTinta) {
  const { ctx, look, x, mw, alinhar } = f
  const s = titulo.tamanho
  if (!look.box) {
    const u = s / look.hs / 9.5, lh = s * 1.12, cen = alinhar === 'center'
    ctx.fillStyle = f.b1
    retanguloArredondado(ctx, cen ? x + (mw - 12 * u) / 2 : x, y, 12 * u, 0.7 * u, 0.35 * u)
    ctx.fill()
    ctx.font = `${look.dw} ${s}px ${look.fd}`
    ctx.fillStyle = corTinta
    ctx.textBaseline = 'top'
    ctx.textAlign = alinhar
    titulo.linhas.forEach((l, i) => ctx.fillText(l, xAlinhado(x, mw, alinhar), y + 4.2 * u + i * lh, mw))
    ctx.textAlign = 'left'
    return
  }
  ctx.font = `800 ${s}px ${look.fd}`
  const pad = s * 0.22, lh = s * 1.25
  ctx.textAlign = 'left'
  titulo.linhas.forEach((l, i) => {
    const w = Math.min(ctx.measureText(l).width, mw - pad * 2) + pad * 2, bx = alinhar === 'center' ? x + (mw - w) / 2 : x, by = y + i * lh
    ctx.fillStyle = f.b1
    retanguloArredondado(ctx, bx, by, w, lh * 0.96, s * 0.14)
    ctx.fill()
    ctx.fillStyle = f.b1i
    ctx.textBaseline = 'middle'
    ctx.fillText(l, bx + pad, by + lh * 0.5, mw - pad * 2)
  })
}

// Texto corrido (plain). `fonte` e `peso` padrão: a fonte de texto do estilo, em 700.
export function montarTexto(f, texto, tamanho, alturaMax, { fonte, peso = 700, entrelinha = 1.3, minimo = 0.6 } = {}) {
  const { ctx, mw } = f
  const familia = fonte ?? f.look.fb
  const quebra = (txt, s) => { ctx.font = `${peso} ${s}px ${familia}`; return quebrarLinhas(txt, mw, medidor(ctx)) }
  const r = encaixarTexto(texto, {
    tamanho, minimo: tamanho * minimo, alturaMax, quebra, altura: (n, s) => n * s * entrelinha,
    larguraMax: mw, largura: larguraNa(ctx, (s) => `${peso} ${s}px ${familia}`),
  })
  return { ...r, familia, peso, entrelinha, h: r.linhas.length * r.tamanho * entrelinha }
}

export function pintarTexto(f, bloco, y, cor) {
  const { ctx, x, mw, alinhar } = f
  ctx.font = `${bloco.peso} ${bloco.tamanho}px ${bloco.familia}`
  ctx.fillStyle = cor
  ctx.textBaseline = 'top'
  ctx.textAlign = alinhar
  bloco.linhas.forEach((l, i) => ctx.fillText(l, xAlinhado(x, mw, alinhar), y + i * bloco.tamanho * bloco.entrelinha, mw))
  ctx.textAlign = 'left'
}

// Texto numa caixa arredondada apoiada em `fundo` (capBox).
export function caixaDeTexto(f, texto, fundo, tamanho, alturaMax, { cor = 'rgba(0,0,0,.6)', tinta = '#fff' } = {}) {
  const { ctx, x, mw, look } = f
  const quebra = (txt, s) => { ctx.font = `800 ${s}px ${look.fb}`; return quebrarLinhas(txt, mw - s * 1.1, medidor(ctx)) }
  const r = encaixarTexto(texto, {
    tamanho, minimo: tamanho * 0.6, alturaMax, quebra, altura: (n, s) => n * s * 1.3 + s * 1.1,
    larguraMax: mw, largura: larguraNa(ctx, (s) => `800 ${s}px ${look.fb}`, 1.1),
  })
  const s = r.tamanho, pad = s * 0.55, lh = s * 1.3, h = r.linhas.length * lh + pad * 2, y = fundo - h
  ctx.fillStyle = cor
  retanguloArredondado(ctx, x, y, mw, h, s * 0.45)
  ctx.fill()
  ctx.font = `800 ${s}px ${look.fb}`
  ctx.fillStyle = tinta
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  r.linhas.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + lh * i + lh / 2, mw - pad * 2))
  return h
}

// ---------- selo de preço ----------

// Medidas do selo: cápsula de no máximo 40% da largura; a fonte encolhe até o valor caber.
function medirSelo(f, preco) {
  const { ctx, u, look } = f
  const pad = 2.2 * u, max = 0.4 * f.W - pad * 2
  let grande = 8.5 * u
  const larg = (txt, tam) => { ctx.font = `800 ${tam}px ${look.fd}`; return ctx.measureText(txt).width }
  const pequeno = () => grande * 0.5
  for (let i = 0; i < 30; i++) {
    const w = Math.max(larg(preco.por, grande), preco.de ? larg(preco.de, pequeno()) : 0)
    if (w <= max) break
    grande *= 0.93
  }
  const peq = pequeno()
  const w = Math.max(larg(preco.por, grande), preco.de ? larg(preco.de, peq) : 0) + pad * 2
  const h = pad * 2 + grande * 1.1 + (preco.de ? peq * 1.25 : 0)
  return { w, h, pad, grande, peq }
}

// Selo de preço (cápsula na cor principal): o valor antigo menor e riscado em cima, o novo grande embaixo.
// `y` é o topo do selo; ele segue o alinhamento do estilo.
function seloDePreco(f, preco, tinta, y) {
  const { ctx, x, mw, look } = f
  const m = medirSelo(f, preco)
  const bx = look.center ? x + (mw - m.w) / 2 : x
  ctx.save()
  ctx.fillStyle = f.b1
  retanguloArredondado(ctx, bx, y, m.w, m.h, m.h * 0.28)
  ctx.fill()
  ctx.fillStyle = f.b1i
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  let ty = y + m.pad
  if (preco.de) {
    ctx.font = `800 ${m.peq}px ${look.fd}`
    ctx.globalAlpha = 0.8
    ctx.fillText(preco.de, bx + m.pad, ty, m.w - m.pad * 2)
    const lw = Math.min(ctx.measureText(preco.de).width, m.w - m.pad * 2)
    ctx.fillRect(bx + m.pad, ty + m.peq * 0.55, lw, Math.max(1, m.peq * 0.08))
    ctx.globalAlpha = 1
    ty += m.peq * 1.25
  }
  ctx.font = `800 ${m.grande}px ${look.fd}`
  ctx.fillText(preco.por, bx + m.pad, ty, m.w - m.pad * 2)
  ctx.restore()
  return m.h
}

// ---------- cartão do pacote de viagem (Turismo) ----------
// No estilo dos cartões de agência: linhas com ícone (hotel, transporte, transfer, datas, refeições), o preço
// "De … por", a unidade, as parcelas, o selo do Pix e o selo do WhatsApp. Painel escuro: lê em qualquer foto.

// Ícones desenhados (caminhos SVG de 24×24): emoji muda de um celular para outro e pode virar quadradinho.
const ICONES = {
  hotel: 'M3 7v11h2v-3h14v3h2v-7a3 3 0 0 0-3-3h-7v6H5V7H3zm4 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  aviao: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
  onibus: 'M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM18 11H6V6h12v5z',
  transfer: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-8l-2.08-5.99zM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM5 11l1.5-4.5h11L19 11H5z',
  data: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11z',
  refeicao: 'M20 3H4v10a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-3h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 5h-2V5h2v3zM2 19h18v2H2z',
  whats: 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.8-2.7-1.1-4.4-3.9-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.1 1.3z',
}
const VERDE = '#25D366'
const caminhos = new Map()

function desenharIcone(ctx, nome, x, y, tam, cor) {
  ctx.save()
  ctx.fillStyle = cor
  if (typeof Path2D === 'function' && ctx.translate) {
    if (!caminhos.has(nome)) caminhos.set(nome, new Path2D(ICONES[nome]))
    ctx.translate(x, y)
    ctx.scale(tam / 24, tam / 24)
    ctx.fill(caminhos.get(nome))
  } else {
    ctx.beginPath(); ctx.arc(x + tam / 2, y + tam / 2, tam / 3, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

// Pílula com texto (e ícone opcional) centralizado ou à esquerda.
function pilula(f, texto, x, y, w, h, tam, { fundo, tinta, icone = null, centro = false }) {
  const { ctx, look } = f
  ctx.save()
  ctx.fillStyle = fundo
  retanguloArredondado(ctx, x, y, w, h, h / 2)
  ctx.fill()
  ctx.font = `800 ${tam}px ${look.fd}`
  const tamIcone = icone ? tam * 1.3 : 0, folga = icone ? tam * 0.5 : 0
  const max = w - h - tamIcone - folga
  const largura = Math.min(ctx.measureText(texto).width, max)
  let tx = centro ? x + (w - largura - tamIcone - folga) / 2 : x + h / 2
  if (icone) { desenharIcone(ctx, icone, tx, y + (h - tamIcone) / 2, tamIcone, tinta); tx += tamIcone + folga }
  ctx.fillStyle = tinta
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(texto, tx, y + h / 2, max)
  ctx.restore()
}

// Texto que cabe em até `max` linhas na largura: a letra diminui até caber; o que sobrar vai junto na última linha.
function quebrarEmAte(f, texto, largura, tam, peso, fonte, max) {
  const { ctx } = f
  let partes
  for (let i = 0; i < 14; i++) {
    ctx.font = `${peso} ${tam}px ${fonte}`
    partes = quebrarLinhas(texto, largura, medidor(ctx))
    if (partes.length <= max) break
    tam *= 0.93
  }
  if (partes.length > max) partes = [...partes.slice(0, max - 1), partes.slice(max - 1).join(' ')]
  return { partes, tam }
}

// A foto cobrindo só um pedaço da arte (de y até o fim).
function fotoNaArea(ctx, img, W, y, h) {
  if (!img) return
  const [iw, ih] = dimensoes(img)
  if (!iw || !ih) return
  ctx.save()
  ctx.beginPath(); ctx.rect(0, y, W, h); ctx.clip?.()
  const s = Math.max(W / iw, h / ih), w = iw * s, hh = ih * s
  ctx.drawImage(img, (W - w) / 2, y + (h - hh) / 2, w, hh)
  ctx.restore()
}

// O painel de informações do pacote (alto da arte) na escala `e`. Com desenhar = false, só mede: devolve a altura.
function painelDoPacote(f, pecas, e, y0, desenhar) {
  const { ctx, u, x, mw, look } = f
  const pc = pecas.pacote
  const tinta = f.b2i
  const fb = look.fb ?? look.fd
  let y = y0
  const texto = (s, tam, peso, fonte, yy, cor = tinta, max = mw, xx = x) => {
    if (!desenhar) return
    ctx.font = `${peso} ${tam}px ${fonte}`; ctx.fillStyle = cor; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText(s, xx, yy, max)
  }
  // chamada ("PACOTE EXCLUSIVO")
  const tc = 3.3 * u * e
  texto(pc.chamada, tc, 700, look.fd, y)
  y += tc * 1.45
  // nome do pacote, grande, em até 2 linhas
  const nome = quebrarEmAte(f, pc.nome.toUpperCase(), mw, 11 * u * e, look.dw, look.fd, 2)
  nome.partes.forEach((l, i) => texto(l, nome.tam, look.dw, look.fd, y + nome.tam * 1.05 * i))
  y += nome.tam * 1.05 * nome.partes.length + 1.5 * u * e
  // dias e ícones do que inclui
  if (pc.dias || pc.icones.length) {
    const td = 4.3 * u * e, ti = 4.6 * u * e
    let xx = x
    if (pc.dias) {
      texto(pc.dias, td, 800, look.fd, y + (ti - td) / 2)
      ctx.font = `800 ${td}px ${look.fd}`
      xx += ctx.measureText(pc.dias).width + 2.5 * u * e
      if (pc.icones.length && desenhar) { ctx.fillStyle = tinta; ctx.globalAlpha = 0.5; ctx.fillRect(xx, y, Math.max(1, 0.3 * u * e), ti); ctx.globalAlpha = 1 }
      xx += 2.5 * u * e
    }
    for (const nomeIcone of pc.icones) {
      if (desenhar) desenharIcone(ctx, nomeIcone, xx, y, ti, tinta)
      xx += ti + 2.2 * u * e
    }
    y += ti + 1.8 * u * e
  }
  // hotel · datas · refeições, em até 2 linhas
  if (pc.linha) {
    const l = quebrarEmAte(f, pc.linha, mw, 3.4 * u * e, 600, fb, 2)
    l.partes.forEach((p, i) => texto(p, l.tam, 600, fb, y + l.tam * 1.3 * i))
    y += l.tam * 1.3 * l.partes.length
  }
  y += 2.6 * u * e
  // bloco de baixo: à esquerda total, "de" e Pix (ou a frase de contato); à direita o quadro do preço
  const caixa = pc.caixa
  const bw = caixa ? 0.4 * mw : 0
  const esq = caixa ? mw - bw - 3 * u * e : mw
  let ye = y
  if (pc.contato) {
    const c = quebrarEmAte(f, pc.contato, esq, 4.4 * u * e, 800, look.fd, 2)
    c.partes.forEach((p, i) => texto(p, c.tam, 800, look.fd, ye + c.tam * 1.2 * i))
    ye += c.tam * 1.2 * c.partes.length
  }
  if (pc.de) {
    const td = 3 * u * e, txt = `De ${pc.de} por`
    texto(txt, td, 700, look.fd, ye, tinta, esq)
    if (desenhar) {
      ctx.font = `700 ${td}px ${look.fd}`
      const w0 = ctx.measureText('De ').width, wv = ctx.measureText(pc.de).width
      ctx.fillStyle = tinta; ctx.fillRect(x + w0, ye + td * 0.5, Math.min(wv, esq - w0), Math.max(1, td * 0.08))
    }
    ye += td * 1.35
  }
  if (pc.total) {
    const tt = quebrarEmAte(f, pc.total, esq, 3.4 * u * e, 700, fb, 2)
    tt.partes.forEach((p, i) => texto(p, tt.tam, 700, fb, ye + tt.tam * 1.3 * i))
    ye += tt.tam * 1.3 * tt.partes.length
  }
  if (pc.pix) {
    ye += 1.4 * u * e
    const tp = 2.7 * u * e, hp = tp * 2
    ctx.font = `800 ${tp}px ${look.fd}`
    const wp = Math.min(ctx.measureText(pc.pix).width + hp, esq)
    if (desenhar) pilula(f, pc.pix, x, ye, wp, hp, tp, { fundo: VERDE, tinta: '#0B2E13' })
    ye += hp
  }
  let yd = y
  if (caixa) {
    const pad = 2.2 * u * e, tt = 2.7 * u * e, tm = 7.5 * u * e
    let tv = 9 * u * e
    ctx.font = `900 ${tv}px ${look.fd}`
    while (ctx.measureText(caixa.valor).width > bw - pad * 2 && tv > 3 * u) { tv *= 0.93; ctx.font = `900 ${tv}px ${look.fd}` }
    const hb = pad * 2 + tt * 1.35 + (caixa.meio ? tm * 1.05 : 0) + tv * 1.05
    if (desenhar) {
      const bx = x + mw - bw
      ctx.save()
      ctx.fillStyle = f.b1
      retanguloArredondado(ctx, bx, y, bw, hb, 1.6 * u * e)
      ctx.fill()
      ctx.restore()
      const cx = bx + bw / 2
      const centro = (s, tam, peso, yy) => {
        ctx.font = `${peso} ${tam}px ${look.fd}`; ctx.fillStyle = f.b1i; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
        ctx.fillText(s, cx, yy, bw - pad * 2)
      }
      let yy = y + pad
      centro(caixa.topo, tt, 700, yy); yy += tt * 1.35
      if (caixa.meio) { centro(caixa.meio, tm, 900, yy); yy += tm * 1.05 }
      centro(caixa.valor, tv, 900, yy)
    }
    yd = y + hb
  }
  return Math.max(ye, yd) - y0
}

// Arte do pacote no estilo das agências (arte única, capa do vídeo e 1ª página do carrossel): no alto, o painel
// na cor da marca com o nome do pacote, dias, ícones, hotel e datas, o preço (ou "Condições especiais"); embaixo
// a foto, com o botão do WhatsApp e a assinatura.
function arteDoPacote(f, { pecas, foto, logo, rotuloTexto }) {
  const { ctx, u, W, H, x, mw } = f
  const vertical = H > W * 1.3
  const maxPainel = Math.round(H * (vertical ? 0.52 : 0.58))
  // a faixa da data especial ocupa o alto do feed
  const y0 = (pecas.ocasiao && !vertical ? 10.5 : 7) * u
  const comRotulo = rotuloTexto ? { ...pecas, pacote: { ...pecas.pacote, chamada: `${rotuloTexto.split(' · ')[0]} · ${pecas.pacote.chamada}` } } : pecas
  // no vertical as letras crescem para ocupar o painel; em todos, encolhem até caber; o painel termina no conteúdo
  let e = vertical ? 1.4 : 1
  for (let i = 0; i < 30 && painelDoPacote(f, comRotulo, e, y0, false) > maxPainel - y0 - 5 * u; i++) e *= 0.96
  const painelH = Math.min(maxPainel, Math.round(y0 + painelDoPacote(f, comRotulo, e, y0, false) + 5 * u))
  // fundo: painel na cor de fundo da marca; embaixo a foto (ou a cor principal, sem foto)
  ctx.fillStyle = f.b2; ctx.fillRect(0, 0, W, painelH)
  const fotoH = H - painelH
  if (foto) {
    fotoNaArea(ctx, foto, W, painelH, fotoH)
    // escurece o pé da foto para o botão e a assinatura aparecerem
    const g = ctx.createLinearGradient(0, painelH, 0, H)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)')
    ctx.fillStyle = g; ctx.fillRect(0, painelH, W, fotoH)
  } else {
    ctx.fillStyle = f.b1; ctx.fillRect(0, painelH, W, fotoH)
  }
  painelDoPacote(f, comRotulo, e, y0, true)
  const pc = pecas.pacote
  if (pc.whatsapp) {
    const hp = 7.2 * u, tp = 3.3 * u, texto = `${t('arte.pacote.whats')} · ${pc.whatsapp}`
    ctx.font = `800 ${tp}px ${f.look.fd}`
    const wp = Math.min(ctx.measureText(texto).width + tp * 1.8 + hp * 1.4, mw)
    pilula(f, texto, x + (mw - wp) / 2, H - 20 * u - hp, wp, hp, tp, { fundo: VERDE, tinta: '#FFFFFF', icone: 'whats', centro: true })
  }
  faixa(f)
  assinar(f, pecas.assinatura, logo, foto ? '#FFFFFF' : f.b1i)
}

// ---------- acabamento ----------

// Acabamento do estilo (band): faixa embaixo (varejo), filete lateral (sóbrio) ou moldura fina (elegante).
export function faixa(f) {
  const { ctx, W, H, u } = f
  if (f.estilo === 'varejo') { ctx.fillStyle = f.b1; ctx.fillRect(0, H - 3.5 * u, W, 3.5 * u) }
  else if (f.estilo === 'sobrio') { ctx.fillStyle = f.b1; ctx.fillRect(0, 0, 1.5 * u, H) }
  else if (f.estilo === 'elegante') {
    ctx.save()
    ctx.strokeStyle = f.b1
    ctx.lineWidth = 0.35 * u
    ctx.strokeRect(4.175 * u, 4.175 * u, W - 8.35 * u, H - 8.35 * u)
    ctx.restore()
  }
}

// Sereno, sem foto: um círculo suave na cor principal (softDeco).
export function enfeiteSuave(f) {
  if (f.estilo !== 'sereno') return
  const { ctx, W, u } = f
  ctx.save()
  ctx.fillStyle = f.b1
  ctx.globalAlpha = 0.22
  ctx.beginPath()
  ctx.arc(W - 11 * u, 11 * u, 35 * u, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Assinatura no canto de baixo (wmk): o texto embaixo e o logo acima dele.
// Assinatura: a logo como marca d'água no canto de baixo à direita e o @ ao lado dela.
export function assinar(f, assinatura, logo, cor) {
  const { ctx, W, H, u, look } = f
  const recuo = look.center ? 8 * u : 0, dir = W - (recuo || 5 * u)
  const base = H - (recuo || 6.5 * u)
  const larguraLogo = assinatura?.logo && logo ? marcaDagua(ctx, logo, dir, base, u) : 0
  if (assinatura?.texto) {
    const folga = larguraLogo ? larguraLogo + 2.5 * u : 0
    ctx.save()
    ctx.globalAlpha = 0.9
    ctx.font = `${look.dw} ${4.2 * u}px ${look.fd}`
    ctx.fillStyle = cor
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(assinatura.texto, dir - folga, base, W - 16 * u - folga)
    ctx.restore()
  }
}

// Fecho do carrossel: o logo grande e o nome no centro (o endSig do v1).
function fecho(f, assinatura, logo, alternativa) {
  const { ctx, W, H, u, look, mw } = f
  let lw = 0, lh = 0
  // a logo só com os nomes, na cor do texto da página (como a marca d'água, mas grande)
  const marca = assinatura?.logo && logo ? logoNaCor(logo, f.b2i) : null
  if (marca) {
    const [iw, ih] = dimensoes(marca)
    if (iw && ih) { const k = Math.min(0.45 * W / iw, 0.2 * H / ih); lw = iw * k; lh = ih * k }
  }
  const texto = assinatura?.texto || (lw ? '' : alternativa)
  const tam = lw ? 5.5 * u : 9 * u
  const bloco = texto ? montarTexto({ ...f, alinhar: 'center' }, texto, tam, 30 * u, { fonte: look.fd, peso: look.dw, entrelinha: 1.2 }) : null
  const gap = lw && bloco ? 4 * u : 0
  let y = (H - lh - gap - (bloco?.h ?? 0)) / 2
  if (lw) { ctx.drawImage(marca, (W - lw) / 2, y, lw, lh); y += lh + gap }
  if (bloco) pintarTexto({ ...f, alinhar: 'center', mw }, bloco, y, f.b2i)
}

// ---------- composições ----------

const fundoLiso = (f) => { f.ctx.fillStyle = f.b2; f.ctx.fillRect(0, 0, f.W, f.H) }

// Fundo com a foto (escurecida) ou, sem foto, a cor de fundo com o enfeite do estilo.
function fundoComFoto(f, foto) {
  fundoLiso(f)
  cobrir(f.ctx, foto, f.W, f.H)
  if (foto) sombrear(f.ctx, f.W, f.H)
  else enfeiteSuave(f)
  return foto ? '#fff' : f.b2i
}

// Arte única (drawSingle). Vertical (Stories, Status, capa de vídeo): rótulo e frase no alto, sem a enquete.
// Feed: título e uma frase de apoio embaixo.
function arteUnica(f, { pecas, foto, logo, capaDeVideo }) {
  if (pecas.pacote) return arteDoPacote(f, { pecas, foto, logo })
  const { u, H, W } = f
  const tinta = fundoComFoto(f, foto)
  const topo = 17 * u, fundo = H - 20 * u
  rotulo(f, pecas.rotulo, 9 * u, tinta)
  if (H > W) {
    // story em enquete: a pergunta (título) em destaque
    const frase = capaDeVideo || pecas.enquete ? pecas.titulo : (pecas.gancho || pecas.titulo)
    // Com selo: o título fica no alto e o selo logo abaixo dele (acima da assinatura).
    const reserva = pecas.preco ? medirSelo(f, pecas.preco).h + 4 * u : 0
    const tit = montarTitulo(f, frase, 9.5 * u, fundo - topo - reserva)
    pintarTitulo(f, tit, topo, tinta)
    if (pecas.preco) seloDePreco(f, pecas.preco, tinta, topo + tit.h + 4 * u)
  } else {
    const apoio = pecas.gancho ? montarTexto(f, pecas.gancho, 5 * u, 22 * u) : null
    const espacoApoio = apoio ? apoio.h + 4 * u : 0
    const reserva = pecas.preco ? medirSelo(f, pecas.preco).h + 3 * u : 0
    const tit = montarTitulo(f, pecas.titulo, 9.5 * u, fundo - topo - espacoApoio - reserva)
    const y = fundo - espacoApoio - tit.h
    pintarTitulo(f, tit, y, tinta)
    if (pecas.preco) seloDePreco(f, pecas.preco, tinta, y - 3 * u - medirSelo(f, pecas.preco).h)
    if (apoio) pintarTexto(f, apoio, y + tit.h + 4 * u, tinta)
  }
  faixa(f)
  assinar(f, pecas.assinatura, logo, tinta)
}

// Texto grande no meio da arte, na fonte do título.
function textoNoMeio(f, texto, tamanho, cor) {
  const { u, H, look } = f
  const bloco = montarTexto(f, texto, tamanho, H - 54 * u, { fonte: look.fd, peso: look.dw, entrelinha: 1.2, minimo: 0.5 })
  pintarTexto(f, bloco, Math.max(17 * u, (H - bloco.h) / 2), cor)
}

// Página do carrossel (drawSlide): 1 capa, 2 gancho, 3 meio com foto, 4 convite na cor principal, 5 fecho.
function paginaDoCarrossel(f, { pecas, foto, logo, pagina }) {
  const { u, H } = f
  const topo = 17 * u, fundo = H - 20 * u
  if (pagina === 1 && pecas.pacote) {
    arteDoPacote(f, { pecas, foto, logo, rotuloTexto: `1/5 · ${pecas.rotulo}` })
  } else if (pagina === 1) {
    const tinta = fundoComFoto(f, foto)
    rotulo(f, `1/5 · ${pecas.rotulo}`, 9 * u, tinta)
    const apoio = montarTexto(f, t('arte.arraste'), 5 * u, 10 * u)
    const reserva = pecas.preco ? medirSelo(f, pecas.preco).h + 3 * u : 0
    const tit = montarTitulo(f, pecas.titulo, 9.5 * u, fundo - topo - apoio.h - 4 * u - reserva)
    const y = fundo - apoio.h - 4 * u - tit.h
    pintarTitulo(f, tit, y, tinta)
    if (pecas.preco) seloDePreco(f, pecas.preco, tinta, y - 3 * u - medirSelo(f, pecas.preco).h)
    pintarTexto(f, apoio, y + tit.h + 4 * u, tinta)
    faixa(f)
    assinar(f, pecas.assinatura, logo, tinta)
  } else if (pagina === 2) {
    fundoLiso(f); enfeiteSuave(f)
    rotulo(f, '2/5', 9 * u, f.b2i)
    textoNoMeio(f, pecas.gancho || pecas.titulo, 9.5 * u, f.b2i)
    faixa(f)
    assinar(f, pecas.assinatura, logo, f.b2i)
  } else if (pagina === 3) {
    const tinta = fundoComFoto(f, foto)
    rotulo(f, '3/5', 9 * u, tinta)
    caixaDeTexto(f, pecas.meio || pecas.gancho || pecas.titulo, fundo, 5.8 * u, fundo - topo, foto ? {} : { cor: f.b1, tinta: f.b1i })
    faixa(f)
    assinar(f, pecas.assinatura, logo, tinta)
  } else if (pagina === 4) {
    f.ctx.fillStyle = f.b1; f.ctx.fillRect(0, 0, f.W, f.H)
    rotulo(f, '4/5', 9 * u, f.b1i, { realce: false })
    textoNoMeio(f, pecas.convite || pecas.titulo, 8 * u, f.b1i)
    assinar(f, pecas.assinatura, logo, f.b1i)
  } else {
    fundoLiso(f); enfeiteSuave(f)
    rotulo(f, '5/5', 9 * u, f.b2i)
    fecho(f, pecas.assinatura, logo, pecas.rotulo)
    faixa(f)
  }
}

// Desenha uma arte inteira no ctx (do tamanho W×H).
// `paginas` > 1 = carrossel, e `pagina` vai de 1 a `paginas`; senão, arte única.
// `capaDeVideo`: na capa do vídeo a frase de cima é o título.
// `pecas.assinatura` já deve vir pronta (assinaturaDaArte).
// `arte`: id da família de artes (familia.js). Posts com preço seguem a composição de antes (o selo de preço mora nela).
export function desenharArte(ctx, { pecas, look, cores, foto = null, logo = null, W, H, pagina = 1, paginas = 1, capaDeVideo = false, arte = null }) {
  // o cartão do pacote (Turismo) também segue essa composição, mesmo sem preço (Ocultar preço)
  if (arte && !pecas.preco && !pecas.pacote) {
    const tipo = paginas > 1 ? 'car' : capaDeVideo ? 'capa' : H > W ? 'stories' : 'feed'
    desenharDaFamilia(ctx, { arte, estilo: nomeDoEstilo(look), pecas, cores, foto, logo, W, H, tipo, pagina, paginas })
  } else {
    // as artes de preço podem ter cores próprias da data (Black Friday: tarjas e selo pretos)
    const f = folha(ctx, { look, cores: cores.precos ?? cores, W, H })
    ctx.save()
    ctx.clearRect(0, 0, W, H)
    if (paginas > 1) paginaDoCarrossel(f, { pecas, foto, logo, pagina })
    else arteUnica(f, { pecas, foto, logo, capaDeVideo })
    ctx.restore()
  }
  // post de uma data especial: a faixa da data no alto do feed (só arte única: o carrossel tem a numeração no alto,
  // e nos stories o Instagram cobre o alto)
  if (pecas.ocasiao && paginas === 1 && !capaDeVideo && H <= W * 1.3) faixaDaData(ctx, { W, ocasiao: pecas.ocasiao, cores })
}
