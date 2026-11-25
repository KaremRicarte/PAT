// Desenho das artes no canvas: a composição do v1 (drawSingle, drawSlide em bancada/index.html),
// com parâmetros explícitos no lugar das variáveis globais. Os cálculos ficam em texto.js.
import { LOOKS } from './looks.js'
import { corTexto, contrasteBom, quebrarLinhas, encaixarTexto } from './texto.js'
import { t } from '../textos.js'
import { desenharDaFamilia } from './familia.js'
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

// Medidas do cartão na escala `e` (1 = tamanho cheio; encolhe até caber no espaço).
function medidasDoCartao(f, pecas, e) {
  const { ctx, u, mw, look } = f
  const pc = pecas.pacote, preco = pecas.preco
  const m = {
    e, pad: 3.2 * u * e, gap: 2 * u * e,
    linha: 3.9 * u * e, icone: 4.2 * u * e, entre: 1.35,
    de: 3.2 * u * e, por: 8.5 * u * e, peq: 2.9 * u * e,
    pilula: 2.8 * u * e, whats: 3.4 * u * e,
  }
  const larguraTexto = mw - m.pad * 2 - m.icone - 2 * u * e
  ctx.font = `600 ${m.linha}px ${look.fb ?? look.fd}`
  // cada linha cabe em até 2 linhas de texto (o hotel longo quebra; além disso, a fonte comprime no fillText)
  m.linhas = pc.linhas.map((l) => ({ ...l, partes: quebrarLinhas(l.texto, larguraTexto, medidor(ctx)).slice(0, 2) }))
  m.larguraTexto = larguraTexto
  let h = m.pad
  h += m.linhas.reduce((s, l) => s + l.partes.length * m.linha * m.entre, 0)
  if (preco) {
    h += m.gap
    if (preco.de) h += m.de * 1.3
    h += m.por * 1.1
    if (pc.unidade) h += m.peq * 1.4
    if (pc.parcelas) h += m.peq * 1.4
    if (pc.pix) h += m.gap + m.pilula * 1.9
  }
  if (pc.whatsapp) h += m.gap + m.whats * 2.2
  m.h = h + m.pad
  return m
}

export function medirCartao(f, pecas, alturaMax) {
  let e = 1
  let m = medidasDoCartao(f, pecas, e)
  for (let i = 0; i < 20 && m.h > alturaMax; i++) { e *= 0.93; m = medidasDoCartao(f, pecas, e) }
  return m
}

// Pílula com texto (e ícone opcional) centralizado ou à esquerda; devolve a altura.
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

// Desenha o cartão com o topo em `y` (medidas de medirCartao). Devolve a altura.
function desenharCartao(f, pecas, m, y) {
  const { ctx, x, mw, u, look } = f
  const pc = pecas.pacote, preco = pecas.preco
  const branco = '#FFFFFF'
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,.6)'
  retanguloArredondado(ctx, x, y, mw, m.h, 3 * u * m.e)
  ctx.fill()
  const ix = x + m.pad, tx = ix + m.icone + 2 * u * m.e
  let cy = y + m.pad
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (const l of m.linhas) {
    const alto = m.linha * m.entre
    desenharIcone(ctx, l.icone, ix, cy + (alto - m.icone) / 2, m.icone, branco)
    ctx.font = `600 ${m.linha}px ${look.fb ?? look.fd}`
    ctx.fillStyle = branco
    l.partes.forEach((p, i) => ctx.fillText(p, tx, cy + alto * i + alto / 2, m.larguraTexto))
    cy += alto * l.partes.length
  }
  const largura = mw - m.pad * 2
  if (preco) {
    cy += m.gap
    ctx.textBaseline = 'top'
    if (preco.de) {
      const txt = `De ${preco.de} por`
      ctx.font = `700 ${m.de}px ${look.fd}`
      ctx.fillStyle = branco
      ctx.globalAlpha = 0.85
      ctx.fillText(txt, ix, cy, largura)
      // risca só o valor antigo
      const w0 = ctx.measureText('De ').width, wv = ctx.measureText(preco.de).width
      ctx.fillRect(ix + w0, cy + m.de * 0.5, Math.min(wv, largura - w0), Math.max(1, m.de * 0.08))
      ctx.globalAlpha = 1
      cy += m.de * 1.3
    }
    ctx.font = `800 ${m.por}px ${look.fd}`
    ctx.fillStyle = branco
    ctx.fillText(preco.por, ix, cy, largura)
    cy += m.por * 1.1
    ctx.font = `600 ${m.peq}px ${look.fb ?? look.fd}`
    for (const txt of [pc.unidade, pc.parcelas]) {
      if (!txt) continue
      ctx.fillText(txt, ix, cy + m.peq * 0.2, largura)
      cy += m.peq * 1.4
    }
    if (pc.pix) {
      cy += m.gap
      ctx.font = `800 ${m.pilula}px ${look.fd}`
      const w = Math.min(ctx.measureText(pc.pix).width + m.pilula * 1.9, largura)
      pilula(f, pc.pix, ix, cy, w, m.pilula * 1.9, m.pilula, { fundo: VERDE, tinta: '#0B2E13' })
      cy += m.pilula * 1.9
    }
  }
  if (pc.whatsapp) {
    cy += m.gap
    pilula(f, `${t('arte.pacote.whats')} · ${pc.whatsapp}`, ix, cy, largura, m.whats * 2.2, m.whats,
      { fundo: VERDE, tinta: branco, icone: 'whats', centro: true })
  }
  ctx.restore()
  return m.h
}

// Arte com o cartão do pacote (arte única, capa do vídeo e 1ª página do carrossel): rótulo e título no alto,
// o cartão embaixo, acima da assinatura.
function arteDoPacote(f, { pecas, foto, logo, rotuloTexto }) {
  const { u, H } = f
  const tinta = fundoComFoto(f, foto)
  const topo = 17 * u, fundo = H - 20 * u
  rotulo(f, rotuloTexto ?? pecas.rotulo, 9 * u, tinta)
  // o título fica com pelo menos 2 linhas pequenas; o resto é do cartão
  const minTitulo = 14 * u
  const m = medirCartao(f, pecas, fundo - topo - minTitulo - 3 * u)
  const tit = montarTitulo(f, pecas.titulo, 8 * u, fundo - topo - m.h - 3 * u)
  pintarTitulo(f, tit, topo, tinta)
  desenharCartao(f, pecas, m, fundo - m.h)
  faixa(f)
  assinar(f, pecas.assinatura, logo, tinta)
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
export function assinar(f, assinatura, logo, cor) {
  const { ctx, W, H, u, look } = f
  const recuo = look.center ? 8 * u : 0, dir = W - (recuo || 5 * u)
  let base = H - (recuo || 6.5 * u)
  ctx.save()
  ctx.globalAlpha = 0.9
  if (assinatura?.texto) {
    ctx.font = `${look.dw} ${4.2 * u}px ${look.fd}`
    ctx.fillStyle = cor
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(assinatura.texto, dir, base, W - 16 * u)
    base -= 5.4 * u
  }
  if (assinatura?.logo && logo) {
    const [lw, lh] = dimensoes(logo)
    if (lw && lh) {
      const k = Math.min(24 * u / lw, 12 * u / lh), w = lw * k, h = lh * k
      ctx.drawImage(logo, dir - w, base - h, w, h)
    }
  }
  ctx.restore()
}

// Fecho do carrossel: o logo grande e o nome no centro (o endSig do v1).
function fecho(f, assinatura, logo, alternativa) {
  const { ctx, W, H, u, look, mw } = f
  let lw = 0, lh = 0
  if (assinatura?.logo && logo) {
    const [iw, ih] = dimensoes(logo)
    if (iw && ih) { const k = Math.min(0.45 * W / iw, 0.2 * H / ih); lw = iw * k; lh = ih * k }
  }
  const texto = assinatura?.texto || (lw ? '' : alternativa)
  const tam = lw ? 5.5 * u : 9 * u
  const bloco = texto ? montarTexto({ ...f, alinhar: 'center' }, texto, tam, 30 * u, { fonte: look.fd, peso: look.dw, entrelinha: 1.2 }) : null
  const gap = lw && bloco ? 4 * u : 0
  let y = (H - lh - gap - (bloco?.h ?? 0)) / 2
  if (lw) { ctx.drawImage(logo, (W - lw) / 2, y, lw, lh); y += lh + gap }
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
