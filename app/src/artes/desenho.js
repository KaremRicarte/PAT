// Desenho das artes no canvas: a composição do v1 (drawSingle, drawSlide em bancada/index.html),
// com parâmetros explícitos no lugar das variáveis globais. Os cálculos ficam em texto.js.
import { LOOKS } from './looks.js'
import { corTexto, contrasteBom, quebrarLinhas, encaixarTexto } from './texto.js'
import { t } from '../textos.js'

// ---------- peças básicas ----------

export function retanguloArredondado(ctx, x, y, w, h, r) {
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
  const { u, H, W } = f
  const tinta = fundoComFoto(f, foto)
  const topo = 17 * u, fundo = H - 20 * u
  rotulo(f, pecas.rotulo, 9 * u, tinta)
  if (H > W) {
    const frase = capaDeVideo ? pecas.titulo : (pecas.gancho || pecas.titulo)
    const tit = montarTitulo(f, frase, 9.5 * u, fundo - topo)
    pintarTitulo(f, tit, topo, tinta)
  } else {
    const apoio = pecas.gancho ? montarTexto(f, pecas.gancho, 5 * u, 22 * u) : null
    const espacoApoio = apoio ? apoio.h + 4 * u : 0
    const tit = montarTitulo(f, pecas.titulo, 9.5 * u, fundo - topo - espacoApoio)
    const y = fundo - espacoApoio - tit.h
    pintarTitulo(f, tit, y, tinta)
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
  if (pagina === 1) {
    const tinta = fundoComFoto(f, foto)
    rotulo(f, `1/5 · ${pecas.rotulo}`, 9 * u, tinta)
    const apoio = montarTexto(f, t('arte.arraste'), 5 * u, 10 * u)
    const tit = montarTitulo(f, pecas.titulo, 9.5 * u, fundo - topo - apoio.h - 4 * u)
    const y = fundo - apoio.h - 4 * u - tit.h
    pintarTitulo(f, tit, y, tinta)
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
export function desenharArte(ctx, { pecas, look, cores, foto = null, logo = null, W, H, pagina = 1, paginas = 1, capaDeVideo = false }) {
  const f = folha(ctx, { look, cores, W, H })
  ctx.save()
  ctx.clearRect(0, 0, W, H)
  if (paginas > 1) paginaDoCarrossel(f, { pecas, foto, logo, pagina })
  else arteUnica(f, { pecas, foto, logo, capaDeVideo })
  ctx.restore()
}
