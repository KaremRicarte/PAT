// Família de artes (todas as áreas): 10 composições que conversam entre si (mesmas cores da cliente, margens e
// assinatura; a fonte vem do estilo do ramo) e uma escolha por post sem padrão fixo e sem repetir as vizinhas.
// Com foto, a foto entra na forma de cada arte (arco, janela, círculo, pedra, céu...).
// A escolha (escolherArte) é pura e testada; o desenho usa só o ctx do canvas.
import { t } from '../textos.js'
import { logoBranca, logoNaCor } from './logoBranca.js'
import { desenharIcone } from './desenho.js'
import { corTexto } from './texto.js'

// ---------- escolha da arte de cada post ----------

// id, tom (para o perfil não pesar para um lado) e se é só para títulos com "?"
export const FAMILIA = Object.freeze([
  { id: 'papel', tom: 'claro' },
  { id: 'arco', tom: 'escuro' },
  { id: 'bilhete', tom: 'escuro' },
  { id: 'cor', tom: 'cor' },
  { id: 'pergunta', tom: 'claro', soPergunta: true },
  { id: 'horizonte', tom: 'misto' },
  { id: 'ondas', tom: 'escuro' },
  { id: 'pedra', tom: 'claro' },
  { id: 'cartao', tom: 'escuro' },
  { id: 'janela', tom: 'claro' },
].map(Object.freeze))

// Sorteio com semente (o mesmo post tem sempre a mesma arte).
export function sorte(s) {
  return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let x = Math.imul(s ^ s >>> 15, 1 | s); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296 }
}
export function hashTexto(s) {
  let h = 2166136261
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}
export const ehPergunta = (titulo) => /\?\s*$/.test(String(titulo ?? ''))

// Uma arte para cada post da sequência (na ordem em que aparecem no perfil): sem repetir as 3 anteriores,
// sem 3 do mesmo tom seguidos, "pergunta" só para títulos com "?" (e de preferência para eles).
export function escolherArtes(sequencia) {
  const usadas = []
  return sequencia.map((p) => {
    const rnd = sorte(hashTexto(p.id ?? p.titulo))
    const pergunta = ehPergunta(p.titulo)
    const tons = usadas.slice(-2).map((x) => x.tom)
    const mesmoTom = tons.length === 2 && tons[0] === tons[1] ? tons[0] : null
    let cand = FAMILIA.filter((f) => (!f.soPergunta || pergunta) && !usadas.slice(-3).includes(f) && f.tom !== mesmoTom)
    if (pergunta && cand.some((f) => f.soPergunta) && rnd() < 0.6) cand = cand.filter((f) => f.soPergunta)
    const f = cand[Math.floor(rnd() * cand.length)] ?? FAMILIA[0]
    usadas.push(f)
    return f
  })
}

// Grade (feed, carrossel e vídeo) e vertical (stories e status) são sequências separadas, por rede.
const grupo = (p) => (p.tipo === 'feed' || p.tipo === 'video' ? 'grade' : p.tipo === 'stories' || p.tipo === 'status' ? 'vertical' : null)
const ordem = (a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.id).localeCompare(String(b.id)))

// A arte do post entre os posts do mês (`posts`; sem eles, só o próprio post).
export function escolherArte(post, posts = []) {
  const g = grupo(post)
  const seq = (posts.some((p) => p.id === post.id) ? posts : [...posts, post])
    .filter((p) => p.rede === post.rede && grupo(p) === g)
    .map((p) => (p.id === post.id ? post : p))
    .sort(ordem)
  const i = seq.findIndex((p) => p.id === post.id)
  return escolherArtes(seq)[i] ?? FAMILIA[0]
}

// ---------- cor ----------

const rgb = (h) => { const n = parseInt(String(h ?? '#888888').slice(1, 7), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255] }
const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
export const misturar = (a, b, k) => { const x = rgb(a), y = rgb(b); return hex(...x.map((v, i) => v + (y[i] - v) * k)) }
const luminancia = (h) => { const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const sobre = (fundo, escura, clara) => (luminancia(fundo) > 0.4 ? escura : clara)
const alfa = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})` }
const saturacao = (h) => { const c = rgb(h), mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0 }
export const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
// escurece a cor até ter `min` de contraste com o branco
const escurecerAte = (cor, min) => { let c = cor; for (let k = 0; k < 30 && contraste(c, '#ffffff') < min; k++) c = misturar(c, '#000000', 0.1); return c }

// A cor de destaque sobre um fundo: se não contrastar (ex.: azul sobre azul), vira um tom claro ou escuro dela.
const destacar = (cor, fundo) => (contraste(cor, fundo) >= 3 ? cor : luminancia(fundo) < 0.3 ? misturar(cor, '#ffffff', 0.6) : misturar(cor, '#000000', 0.5))

// Os papéis das cores nas artes, venham as cores do cliente em qualquer ordem:
// c1 = destaque (a mais viva das duas); c2 = a tinta escura (a mais escura, escurecida até o texto ler bem).
// Ex.: Malibu (azul + cinza-claro) -> destaque azul e tinta azul-marinho; antes o cinza-claro virava a cor do texto.
export function paletaDaArte(cor1, cor2) {
  const a = cor1 || '#cccccc', b = cor2 || '#333333'
  const acento = saturacao(b) > saturacao(a) + 0.15 ? b : a
  const escura = luminancia(a) <= luminancia(b) ? a : b
  // e a tinta precisa se separar do destaque (quando as duas vêm da mesma cor, vira um tom bem mais fundo)
  let c2 = escurecerAte(escura, 7)
  for (let k = 0; k < 30 && contraste(c2, acento) < 2.5; k++) c2 = misturar(c2, '#000000', 0.1)
  return { c1: acento, c2 }
}

// ---------- fontes de cada estilo (looks.js) ----------

// A voz do título: a fonte em peso leve e forte, e se o itálico está carregado (o varejo não tem itálico).
const VOZES = Object.freeze({
  sereno: { fd: '"Fraunces",Georgia,serif', fb: '"DM Sans","Segoe UI",sans-serif', leve: 300, forte: 400, italico: true },
  elegante: { fd: '"Cormorant Garamond",Georgia,serif', fb: '"Montserrat","Segoe UI",sans-serif', leve: 500, forte: 600, italico: true },
  sobrio: { fd: '"Playfair Display",Georgia,serif', fb: '"Source Sans 3","Segoe UI",sans-serif', leve: 400, forte: 700, italico: true },
  varejo: { fd: '"Bricolage Grotesque","Segoe UI",sans-serif', fb: '"Nunito Sans","Segoe UI",sans-serif', leve: 700, forte: 800, italico: false },
})
const vozDe = (estilo) => VOZES[estilo] ?? VOZES.varejo

// Fontes que a família usa num estilo (carregar antes de desenhar).
export function fontesDaFamilia(estilo) {
  const v = vozDe(estilo)
  const titulo = [`${v.leve} 40px ${v.fd}`, `${v.forte} 40px ${v.fd}`]
  if (v.italico) titulo.push(`italic ${v.leve} 40px ${v.fd}`, `italic ${v.forte} 40px ${v.fd}`)
  return [...titulo, `400 40px ${v.fb}`, `600 40px ${v.fb}`, `700 40px ${v.fb}`]
}

// ---------- texto ----------

// Quebra o texto em linhas (as últimas `italicoFinal` palavras em destaque) e encolhe até caber em largura x altura.
// Se nem no menor tamanho couber, corta com reticências.
export function montar(ctx, texto, { tam, min = 0.55, largura, altura, lh = 1.12, fonte, italicoFinal = 0 }) {
  // \n no texto (item de lista) começa uma linha nova
  const palavras = String(texto ?? '').split(/\n+/).flatMap((seg, n) => seg.split(/[ \t]+/).filter(Boolean).map((p, j) => ({ p, br: n > 0 && j === 0 })))
    .map((tok, i, lista) => ({ ...tok, it: i >= lista.length - italicoFinal }))
  const quebrar = (s) => {
    const linhas = [[]]
    let w = 0
    ctx.font = fonte(s, false)
    const esp = ctx.measureText(' ').width
    for (const tok of palavras) {
      ctx.font = fonte(s, tok.it)
      const tw = ctx.measureText(tok.p).width
      const novo = linhas.at(-1).length ? w + esp + tw : tw
      if ((tok.br || novo > largura) && linhas.at(-1).length) { linhas.push([tok]); w = tw } else { linhas.at(-1).push(tok); w = novo }
    }
    return linhas
  }
  if (!palavras.length || altura <= 0) return { s: tam, linhas: [], lh, fonte, h: 0 }
  let s = tam
  for (; s >= tam * min; s *= 0.96) {
    const linhas = quebrar(s)
    if (linhas.length * s * lh <= altura) return { s, linhas, lh, fonte, h: linhas.length * s * lh }
  }
  s = tam * min
  const cabem = Math.max(1, Math.floor(altura / (s * lh)))
  const linhas = quebrar(s).slice(0, cabem)
  const ultima = linhas.at(-1)
  if (ultima.length) ultima[ultima.length - 1] = { ...ultima.at(-1), p: `${ultima.at(-1).p.replace(/[\s,.;:!?-]+$/, '')}…` }
  return { s, linhas, lh, fonte, h: linhas.length * s * lh }
}

function pintar(ctx, b, x, y, cor, { alinhar = 'left', largura = 0, corItalico } = {}) {
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  b.linhas.forEach((linha, i) => {
    ctx.font = b.fonte(b.s, false)
    const esp = ctx.measureText(' ').width
    const ws = linha.map((tok) => { ctx.font = b.fonte(b.s, tok.it); return ctx.measureText(tok.p).width })
    const total = ws.reduce((a, c) => a + c, 0) + esp * (linha.length - 1)
    let cx = alinhar === 'center' ? x + (largura - total) / 2 : x
    linha.forEach((tok, j) => {
      ctx.font = b.fonte(b.s, tok.it)
      ctx.fillStyle = tok.it && corItalico ? corItalico : cor
      ctx.fillText(tok.p, cx, y + i * b.s * b.lh)
      cx += ws[j] + esp
    })
  })
}

function rotulo(f, texto, x, y, tam, cor, { alinhar = 'left', espacamento = 0.14, peso = 700, maxW } = {}) {
  if (!texto) return
  const { ctx } = f
  ctx.save()
  ctx.font = `${peso} ${tam}px ${f.voz.fb}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tam * espacamento}px`
  ctx.fillStyle = cor
  ctx.textBaseline = 'top'
  ctx.textAlign = alinhar
  ctx.fillText(texto, x, y, maxW)
  ctx.restore()
}

// ---------- formas e foto ----------

function retangulo(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}
function bolha(ctx, cx, cy, r, semente, oscila = 0.14) {
  const rnd = sorte(semente), n = 7, pts = []
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rnd() * 0.3, rr = r * (1 - oscila + rnd() * oscila * 2)
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  const meio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  ctx.beginPath()
  ctx.moveTo(...meio(pts[n - 1], pts[0]))
  for (let i = 0; i < n; i++) { const p = pts[i], m = meio(p, pts[(i + 1) % n]); ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]) }
  ctx.closePath()
}
function arco(ctx, x, y, w, h) {
  const r = w / 2
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath()
}
function grao(ctx, x0, y0, W, H, forca = 0.05, semente = 7) {
  const rnd = sorte(semente), n = Math.round(W * H / 220), lado = Math.max(1.2, W / 450)
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${forca * rnd()})` : `rgba(0,0,0,${forca * rnd()})`
    ctx.fillRect(x0 + rnd() * W, y0 + rnd() * H, lado, lado)
  }
}
const circulo = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2) }
const dimensoes = (img) => [img.naturalWidth || img.width, img.naturalHeight || img.height]

// Logo como marca d'água: pequena, branca e transparente, com o canto de baixo à direita em (dir, base). Devolve a largura.
export function marcaDagua(ctx, logo, dir, base, u, cor = null) {
  // a logo branca (ou na cor pedida, em fundo claro), recortada em volta do nome: o tamanho vem dela
  const branca = cor ? logoNaCor(logo, cor) : logoBranca(logo)
  const [lw, lh] = dimensoes(branca)
  if (!lw || !lh) return 0
  const k = Math.min(15 * u / lw, 6 * u / lh), w = lw * k, h = lh * k
  ctx.save()
  // branca e forte (mesmo que a logo seja colorida): uma sombra fininha para destacar em fundo claro
  // e, por cima, um brilho branco suave
  ctx.globalAlpha = 0.95
  // relevo: sombra suave logo abaixo, como uma logo em alto-relevo
  ctx.shadowColor = 'rgba(0,0,0,.45)'
  ctx.shadowBlur = 0.7 * u
  ctx.shadowOffsetY = 0.25 * u
  ctx.drawImage(branca, dir - w, base - h, w, h)
  ctx.shadowOffsetY = 0
  ctx.shadowColor = 'rgba(255,255,255,.7)'
  ctx.shadowBlur = 1.6 * u
  ctx.drawImage(branca, dir - w, base - h, w, h)
  ctx.restore()
  return w
}


// A foto cobrindo o retângulo (x, y, w, h), cortando o que sobra.
function cobrirEm(ctx, img, x, y, w, h) {
  const [iw, ih] = dimensoes(img)
  if (!iw || !ih) return
  const s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}
// A foto sangrando num retângulo que encosta nas bordas da arte (sem moldura: foto em forma não se usa mais).
// veuTopo/veuBase: escurecem o alto ou o pé da foto para o rótulo e a assinatura lerem bem.
function fotoSangrada(f, x, y, w, h, { veuTopo = false, veuBase = false } = {}) {
  const { ctx } = f
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
  cobrirEm(ctx, f.foto, x, y, w, h)
  const veu = (y0, y1, a0, a1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, `rgba(0,0,0,${a0})`); g.addColorStop(1, `rgba(0,0,0,${a1})`); ctx.fillStyle = g; ctx.fillRect(x, y0, w, y1 - y0) }
  if (veuTopo) veu(y, y + Math.min(h * 0.4, 40 * f.u), 0.5, 0)
  if (veuBase) veu(y + h - Math.min(h * 0.45, 45 * f.u), y + h, 0, 0.55)
  ctx.restore()
}
// A foto na arte inteira, escurecida para o texto claro aparecer.
function fotoDeFundo(f, escurecer = 0.55) {
  const { ctx, W, H } = f
  cobrirEm(ctx, f.foto, 0, 0, W, H)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, `rgba(0,0,0,${escurecer * 0.7})`); g.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, escurecer + 0.2)})`)
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
}

// ---------- a folha: tudo o que as artes precisam ----------

function folha(ctx, { pecas, cores, logo, foto, estilo, W, H, tipo, pagina, paginas = 1 }) {
  // cores de uma data especial (temas.js) já vêm nos papéis certos; as do cliente passam pela paleta
  const { c1, c2 } = cores.fixas ? { c1: cores.cor1, c2: cores.cor2 } : paletaDaArte(cores.cor1, cores.cor2), voz = vozDe(estilo)
  const fonte = (peso) => (s, it) => `${it && voz.italico ? 'italic ' : ''}${peso} ${s}px ${voz.fd}`
  return {
    ctx, W, H, u: W / 100, tipo, pagina, total: paginas, logo, foto, voz,
    // Turismo: a palavra-tema da capa (as páginas de dentro ficam sem formas abstratas)
    palavra: pecas.palavra ?? null,
    blocos: pecas.blocos ?? { gancho: pecas.gancho ?? '', meios: pecas.meio ? [pecas.meio] : [], convite: pecas.convite ?? '' },
    leve: fonte(voz.leve), forte: fonte(voz.forte),
    // frase toda em itálico (no varejo, sem itálico)
    frase: (s) => `${voz.italico ? 'italic ' : ''}${voz.leve} ${s}px ${voz.fd}`,
    corrido: (peso) => (s) => `${peso} ${s}px ${voz.fb}`,
    c1, c2,
    papel: cores.papel ?? misturar(c1, '#ffffff', 0.62), tinta: cores.tinta ?? misturar(c2, '#000000', 0.25), claro: cores.claro ?? misturar(c1, '#ffffff', 0.7),
    // sem itálico, o destaque do fim do título fica só na cor: mais forte
    destaque: cores.destaque ?? (voz.italico ? misturar(c2, c1, 0.15) : misturar(c2, c1, 0.45)),
    titulo: pecas.titulo ?? '',
    // stories: o título grande e o começo da legenda embaixo; capa de vídeo: só o título; carrossel: "Arraste"
    apoio: tipo === 'capa' ? '' : tipo === 'car' ? t('arte.arraste') : (pecas.gancho ?? ''),
    gancho: pecas.gancho || pecas.titulo || '',
    meio: pecas.meio || pecas.gancho || pecas.titulo || '',
    convite: pecas.convite || pecas.titulo || '',
    nome: pecas.rotulo ?? '',
    insta: pecas.assinatura?.texto ?? null,
    temLogo: Boolean(pecas.assinatura?.logo && logo),
  }
}

// No alto: o número da página no carrossel; nas outras artes, o nome do negócio.
const marca = (f) => (f.tipo === 'car' ? `${String(f.pagina).padStart(2, '0')} — ${String(f.total).padStart(2, '0')}` : f.nome)

// Assinatura padrão: o @ (ou o nome) à esquerda; à direita, o logo ou o nome pequeno.
function assinar(f, cor, { centro = false } = {}) {
  const { W, H, u } = f
  const principal = f.insta || (f.temLogo ? null : f.nome)
  if (centro) {
    // a logo fica de marca d'água no canto; o @ (ou o nome) no meio
    if (f.temLogo) logoEm(f)
    if (!principal) return
    return rotulo(f, principal, W / 2, H - 10.5 * u, 3.3 * u, cor, { alinhar: 'center', espacamento: 0.02, peso: 600, maxW: W - 18 * u })
  }
  rotulo(f, principal, 9 * u, H - 9.5 * u, 3.3 * u, cor, { espacamento: 0.02, peso: 600, maxW: W * 0.5 })
  if (f.temLogo) logoEm(f)
  else if (f.insta && f.tipo !== 'car') rotulo(f, f.nome, W - 9 * u, H - 9.3 * u, 2.6 * u, alfa(cor, 0.7), { alinhar: 'right', maxW: W * 0.36 })
}
// A logo como marca d'água: pequena e transparente, no canto de baixo à direita.
function logoEm(f) {
  marcaDagua(f.ctx, f.logo, f.W - 6 * f.u, f.H - 5.5 * f.u, f.u)
}

// ---------- as 10 capas (feed, stories, capa de vídeo e página 1 do carrossel) ----------

function papel(f) {
  const { ctx, W, H, u } = f, x = 9 * u, mw = W - 18 * u, vertical = H > W * 1.5
  ctx.fillStyle = f.papel; ctx.fillRect(0, 0, W, H)
  // com foto: a foto ocupa o pé da arte, de borda a borda; sem foto: uma forma grande saindo pelo canto
  const yFoto = H * (vertical ? 0.56 : 0.6)
  if (f.foto) fotoSangrada(f, 0, yFoto, W, H - yFoto, { veuBase: true })
  else {
    const [cx, cy, r] = [W * (vertical ? 0.92 : 0.86), H * (vertical ? 0.86 : 0.9), (vertical ? 52 : 40) * u]
    ctx.fillStyle = f.c1; bolha(ctx, cx, cy, r, 3); ctx.fill()
    ctx.save(); ctx.strokeStyle = alfa(f.tinta, 0.35); ctx.lineWidth = 0.3 * u
    bolha(ctx, cx - 4 * u, cy - 3 * u, r * 0.98, 21); ctx.stroke(); ctx.restore()
  }
  rotulo(f, f.nome, x, 8 * u, 2.9 * u, alfa(f.tinta, 0.75), { maxW: mw * 0.7 })
  if (f.tipo === 'car') rotulo(f, marca(f), W - x, 8 * u, 2.9 * u, alfa(f.tinta, 0.75), { alinhar: 'right' })
  ctx.fillStyle = alfa(f.tinta, 0.25); ctx.fillRect(x, 13 * u, mw, 0.18 * u)
  const topo = vertical ? 30 * u : 22 * u
  const limite = f.foto ? yFoto - 6 * u : H - 16 * u
  const a0 = montar(ctx, f.apoio, { min: 0.8, tam: 4.3 * u, largura: mw * 0.86, altura: f.foto ? 18 * u : 26 * u, fonte: f.corrido(400), lh: 1.45 })
  const b = montar(ctx, f.titulo, { tam: (vertical ? 10.5 : 9.6) * u, largura: mw, altura: Math.min(H * 0.46, limite - topo - (a0.h ? a0.h + 5 * u : 0)), fonte: f.leve, lh: 1.1, italicoFinal: 3 })
  pintar(ctx, b, x, topo, f.tinta, { corItalico: f.destaque })
  const ya = topo + b.h + 5 * u
  const a = montar(ctx, f.apoio, { min: 0.8, tam: 4.3 * u, largura: mw * 0.86, altura: limite - ya, fonte: f.corrido(400), lh: 1.45 })
  pintar(ctx, a, x, ya, alfa(f.tinta, 0.82))
  assinar(f, f.foto ? '#ffffff' : f.tinta)
}

function arcoCapa(f) {
  const { ctx, W, H, u } = f, vertical = H > W * 1.5, tintaArco = misturar(f.c2, '#000000', 0.35), luz = misturar(f.c1, '#ffffff', 0.6)
  ctx.fillStyle = f.c2; ctx.fillRect(0, 0, W, H)
  const ax = 11 * u, aw = W - 22 * u, ay = vertical ? 14 * u : 10 * u, ah = H - ay - 16 * u
  if (f.foto) {
    // com foto: a foto no alto, de borda a borda; o arco de cor sobe por cima dela e leva o texto
    const corte = H * (vertical ? 0.5 : 0.46), topoArco = corte - aw * 0.32
    fotoSangrada(f, 0, 0, W, corte + 2, { veuTopo: true })
    ctx.fillStyle = f.c2; ctx.fillRect(0, corte, W, H - corte)
    ctx.fillStyle = f.c1; arco(ctx, ax, topoArco, aw, H - 16 * u - topoArco); ctx.fill()
    if (f.tipo === 'car') rotulo(f, `1 / ${f.total}`, W / 2, 4 * u, 2.8 * u, 'rgba(255,255,255,.85)', { alinhar: 'center' })
    const pad = 8 * u, larg = aw - pad * 2, tinta = sobre(f.c1, tintaArco, '#ffffff')
    const topo = topoArco + aw * 0.22, fundo = H - 22 * u
    const a = montar(ctx, f.apoio, { min: 0.8, tam: 3.9 * u, largura: larg, altura: (fundo - topo) * 0.3, fonte: f.corrido(500), lh: 1.4 })
    const b = montar(ctx, f.titulo, { tam: (vertical ? 8.6 : 7.6) * u, largura: larg, altura: fundo - topo - (a.h ? a.h + 4 * u : 0), fonte: f.forte, italicoFinal: 3 })
    const y = topo + (fundo - topo - b.h - (a.h ? a.h + 4 * u : 0)) / 2
    pintar(ctx, b, ax + pad, y, tinta, { alinhar: 'center', largura: larg })
    pintar(ctx, a, ax + pad, y + b.h + 4 * u, alfa(tinta, 0.85), { alinhar: 'center', largura: larg })
    return assinar(f, luz)
  }
  ctx.fillStyle = f.c1; arco(ctx, ax, ay, aw, ah); ctx.fill()
  ctx.fillStyle = luz; circulo(ctx, ax + aw - 9 * u, ay + 9 * u, 6.5 * u); ctx.fill()
  if (f.tipo === 'car') rotulo(f, `1 / ${f.total}`, W / 2, 4 * u, 2.8 * u, alfa(luz, 0.8), { alinhar: 'center' })
  const pad = 9 * u, larg = aw - pad * 2
  // o apoio no pé do arco; o título centrado no espaço entre a curva e o apoio, sem encostar nele
  const a = montar(ctx, f.apoio, { min: 0.8, tam: 3.9 * u, largura: aw - 22 * u, altura: 20 * u, fonte: f.corrido(500), lh: 1.45 })
  const yApoio = ay + ah - a.h - 8 * u
  const topo = ay + aw * 0.32, fundo = (a.h ? yApoio - 5 * u : ay + ah - 8 * u)
  const b = montar(ctx, f.titulo, { tam: (vertical ? 9.6 : 8.6) * u, largura: larg, altura: fundo - topo, fonte: f.forte, italicoFinal: 3 })
  // texto sobre a cor de destaque: escuro se ela for clara, branco se for escura (ex.: o azul da Malibu)
  const tx = sobre(f.c1, tintaArco, '#ffffff')
  pintar(ctx, b, ax + pad, topo + (fundo - topo - b.h) / 2, tx, { alinhar: 'center', largura: larg, corItalico: tx === '#ffffff' ? misturar(f.c1, '#ffffff', 0.6) : misturar(f.c2, f.c1, 0.1) })
  pintar(ctx, a, ax + 11 * u, yApoio, alfa(tx, 0.85), { alinhar: 'center', largura: aw - 22 * u })
  assinar(f, luz)
}

function fundoEscuroSuave(f) {
  const { ctx, W, H } = f
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H)
  g.addColorStop(0, misturar(f.c2, f.c1, 0.05)); g.addColorStop(1, misturar(f.c2, f.c1, 0.38))
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  grao(ctx, 0, 0, W, H, 0.06)
}
function aspas(f, cor, y, tam = 34) {
  const { ctx, u } = f
  ctx.font = `${f.voz.forte} ${tam * u}px ${f.voz.fd}`; ctx.fillStyle = cor; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText('“', 8 * u, y)
}
function bilhete(f) {
  const { ctx, W, H, u } = f, x = 10 * u, mw = W - 20 * u, vertical = H > W * 1.5
  if (f.foto) fotoDeFundo(f, 0.55)
  else fundoEscuroSuave(f)
  const corAspas = f.foto ? f.c1 : destacar(f.c1, misturar(f.c2, f.c1, 0.1))
  if (f.tipo === 'car') rotulo(f, `1/${f.total}`, W - x, 8 * u, 2.8 * u, alfa(f.claro, 0.7), { alinhar: 'right' })
  const yA = vertical ? 18 * u : 9 * u
  aspas(f, corAspas, yA)
  const yT = yA + 28 * u
  const b = montar(ctx, f.titulo, { tam: (vertical ? 10.4 : 9.4) * u, largura: mw, altura: H - yT - 48 * u, fonte: f.frase, lh: 1.12 })
  pintar(ctx, b, x, yT, f.claro)
  const a = montar(ctx, f.apoio, { min: 0.8, tam: 4.2 * u, largura: mw * 0.85, altura: 24 * u, fonte: f.corrido(400), lh: 1.45 })
  pintar(ctx, a, x, yT + b.h + 6 * u, alfa(f.claro, 0.85))
  ctx.fillStyle = alfa(f.claro, 0.35); ctx.fillRect(x, H - 15 * u, 10 * u, 0.25 * u)
  assinar(f, f.claro)
}

function corCheia(f) {
  const { ctx, W, H, u } = f, tinta = sobre(f.c1, f.tinta, '#ffffff')
  ctx.fillStyle = f.c1; ctx.fillRect(0, 0, W, H)
  // com foto: a foto em cima, de borda a borda, e a cor cheia embaixo com o texto
  const corte = f.foto ? H * 0.5 : 0
  const cx = W - 4 * u, cy = H * 0.3
  if (f.foto) fotoSangrada(f, 0, 0, W, corte, { veuTopo: true })
  else {
    ctx.strokeStyle = alfa(tinta, 0.4); ctx.lineWidth = 0.35 * u
    circulo(ctx, cx, cy, 30 * u); ctx.stroke(); circulo(ctx, cx, cy, 22 * u); ctx.stroke()
  }
  rotulo(f, marca(f), 9 * u, 8 * u, 2.8 * u, f.foto ? 'rgba(255,255,255,.85)' : alfa(tinta, 0.7), { maxW: W * 0.6 })
  const a = montar(ctx, f.apoio, { min: 0.8, tam: 4.2 * u, largura: W * 0.7, altura: 22 * u, fonte: f.corrido(400), lh: 1.45 })
  const espaco = f.foto ? H - corte - 7 * u - 17 * u - (a.h ? a.h + 5 * u : 0) : H - cy - 30 * u - 17 * u - a.h
  const b = montar(ctx, f.titulo, { tam: 10 * u, largura: W - 18 * u, altura: Math.min(H * 0.42, espaco), fonte: f.leve, lh: 1.08, italicoFinal: 2 })
  const y = H - 17 * u - (a.h ? a.h + 5 * u : 0) - b.h
  // destaque sem itálico: um tom que contrasta com a cor cheia (claro sobre cor escura, escuro sobre cor clara)
  pintar(ctx, b, 9 * u, y, tinta, { corItalico: f.voz.italico ? undefined : tinta === '#ffffff' ? misturar(f.c1, '#ffffff', 0.6) : f.c2 })
  pintar(ctx, a, 9 * u, y + b.h + 5 * u, alfa(tinta, 0.85))
  assinar(f, tinta)
}

function pergunta(f) {
  const { ctx, W, H, u } = f, x = 9 * u, mw = W - 18 * u, vertical = H > W * 1.5
  ctx.fillStyle = f.papel; ctx.fillRect(0, 0, W, H)
  rotulo(f, marca(f), x, 8 * u, 2.8 * u, alfa(f.tinta, 0.7), { maxW: W * 0.6 })
  const topo = vertical ? 26 * u : 20 * u
  let limite, largApoio = mw * 0.86
  const fonteSinal = (s) => `${f.voz.forte} ${s}px ${f.voz.fd}`
  if (f.foto) {
    // a foto no pé, de borda a borda; o "?" num selo redondo na cor de destaque, sobre a linha da foto
    const yFoto = H * (vertical ? 0.56 : 0.6)
    fotoSangrada(f, 0, yFoto, W, H - yFoto, { veuBase: true })
    const r = (vertical ? 11 : 10) * u, cx = W - x - r, cy = yFoto
    ctx.fillStyle = f.c1; circulo(ctx, cx, cy, r); ctx.fill()
    ctx.font = fonteSinal(r * 1.3); ctx.fillStyle = sobre(f.c1, f.tinta, '#ffffff'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('?', cx, cy + r * 0.05)
    limite = yFoto - r - 4 * u
  } else {
    // o "?" grande no canto de baixo, sem encostar no texto
    const tam = H * (vertical ? 0.46 : 0.56), base = H - 12 * u, dir = W - 5 * u
    ctx.font = fonteSinal(tam); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'
    const m = ctx.measureText('?'), alto = m.actualBoundingBoxAscent || tam * 0.72, largo = m.width || tam * 0.5
    ctx.fillStyle = f.c1; ctx.fillText('?', dir, base)
    limite = base - alto - 5 * u
    largApoio = Math.min(mw * 0.86, dir - largo - x - 4 * u)
  }
  const a0 = montar(ctx, f.apoio, { min: 0.8, tam: 4.2 * u, largura: mw * 0.86, altura: 20 * u, fonte: f.corrido(400), lh: 1.45 })
  const b = montar(ctx, f.titulo, { tam: (vertical ? 10.4 : 9.4) * u, largura: mw * 0.92, altura: Math.min(H * 0.5, limite - topo - (f.foto && a0.h ? a0.h + 5 * u : 0)), fonte: f.leve, lh: 1.1, italicoFinal: 2 })
  pintar(ctx, b, x, topo, f.tinta, { corItalico: f.destaque })
  const ya = topo + b.h + 5 * u
  // sem foto, o apoio pode descer ao lado do "?"
  const a = montar(ctx, f.apoio, { min: 0.8, tam: 4.2 * u, largura: largApoio, altura: (f.foto ? limite : H - 18 * u) - ya, fonte: f.corrido(400), lh: 1.45 })
  pintar(ctx, a, x, ya, alfa(f.tinta, 0.82))
  assinar(f, f.foto ? '#ffffff' : f.tinta)
}

function horizonte(f) {
  const { ctx, W, H, u } = f, linha = H * 0.5
  if (f.foto) cobrirEm(ctx, f.foto, 0, 0, W, linha)
  else { ctx.fillStyle = f.c2; ctx.fillRect(0, 0, W, linha) }
  ctx.fillStyle = f.papel; ctx.fillRect(0, linha, W, H - linha)
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, linha); ctx.clip()
  if (f.foto) {
    // a foto vira o céu: um véu escuro no alto para o rótulo e o sol na linha
    const g = ctx.createLinearGradient(0, 0, 0, linha * 0.4); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, linha)
  }
  ctx.fillStyle = f.c1; circulo(ctx, W * 0.68, linha, (f.foto ? 11 : 17) * u); ctx.fill()
  ctx.strokeStyle = alfa(f.c1, f.foto ? 0.7 : 0.35); ctx.lineWidth = 0.3 * u; circulo(ctx, W * 0.68, linha, (f.foto ? 16 : 25) * u); ctx.stroke()
  ctx.restore()
  rotulo(f, marca(f), 9 * u, 8 * u, 2.8 * u, alfa(f.claro, 0.85), { maxW: W * 0.6 })
  const b = montar(ctx, f.titulo, { tam: 8.6 * u, largura: W - 18 * u, altura: (H - linha) * 0.5, fonte: f.leve, lh: 1.1, italicoFinal: 3 })
  pintar(ctx, b, 9 * u, linha + 7 * u, f.tinta, { corItalico: f.destaque })
  const a = montar(ctx, f.apoio, { min: 0.8, tam: 4.2 * u, largura: W * 0.78, altura: H - linha - b.h - 32 * u, fonte: f.corrido(400), lh: 1.45 })
  pintar(ctx, a, 9 * u, linha + 7 * u + b.h + 4.5 * u, alfa(f.tinta, 0.82))
  assinar(f, f.tinta)
}

function ondas(f) {
  const { ctx, W, H, u } = f, cx = W * 0.5, cy = H * 0.3, larg = W - 20 * u
  if (f.foto) fotoDeFundo(f, 0.6)
  else { ctx.fillStyle = misturar(f.c2, '#000000', 0.15); ctx.fillRect(0, 0, W, H) }
  // as ondas só sem foto (por cima da foto, ficam sujas)
  if (!f.foto) {
    ctx.lineWidth = 0.35 * u
    for (let i = 0; i < 8; i++) { ctx.strokeStyle = alfa(f.c1, 0.55 - i * 0.06); circulo(ctx, cx, cy, (6 + i * 6.5) * u); ctx.stroke() }
    ctx.fillStyle = f.c1; circulo(ctx, cx, cy, 4 * u); ctx.fill()
  }
  rotulo(f, marca(f), 9 * u, 8 * u, 2.8 * u, alfa(f.claro, 0.75), { maxW: W * 0.6 })
  const b = montar(ctx, f.titulo, { tam: 8.6 * u, largura: larg, altura: H * 0.28, fonte: f.frase, lh: 1.12 })
  const y = Math.max(cy + 58 * u, H * 0.6)
  pintar(ctx, b, 10 * u, y - b.h / 2, f.claro, { alinhar: 'center', largura: larg })
  const a = montar(ctx, f.apoio, { min: 0.8, tam: 4.2 * u, largura: larg, altura: H - y - b.h / 2 - 22 * u, fonte: f.corrido(400), lh: 1.45 })
  pintar(ctx, a, 10 * u, y + b.h / 2 + 4 * u, alfa(f.claro, 0.85), { alinhar: 'center', largura: larg })
  assinar(f, f.claro)
}

function pedra(f) {
  const { ctx, W, H, u } = f, cy = H * 0.44, r = 41 * u, larg = r * 1.3
  ctx.fillStyle = f.papel; ctx.fillRect(0, 0, W, H)
  rotulo(f, marca(f), 9 * u, 8 * u, 2.8 * u, alfa(f.tinta, 0.7), { maxW: W * 0.6 })
  if (f.foto) {
    // com foto: a foto ocupa metade da arte, de borda a borda (no alto nos stories; à esquerda no feed)
    const vertical = H > W * 1.5
    if (vertical) {
      const corte = H * 0.48
      fotoSangrada(f, 0, 0, W, corte, { veuTopo: true })
      ctx.fillStyle = f.c1; ctx.fillRect(0, corte, W, 1.2 * u)
      const mw = W - 18 * u, yb = corte + 9 * u
      const b = montar(ctx, f.titulo, { tam: 9.6 * u, largura: mw, altura: (H - yb) * 0.5, fonte: f.leve, lh: 1.1, italicoFinal: 2 })
      pintar(ctx, b, 9 * u, yb, f.tinta, { corItalico: f.destaque })
      const a = montar(ctx, f.apoio, { min: 0.8, tam: 4.2 * u, largura: mw * 0.86, altura: H - yb - b.h - 26 * u, fonte: f.corrido(400), lh: 1.45 })
      pintar(ctx, a, 9 * u, yb + b.h + 5 * u, alfa(f.tinta, 0.82))
      return assinar(f, f.tinta)
    }
    const corte = W * 0.46
    ctx.fillStyle = f.papel; ctx.fillRect(0, 0, W, H)
    fotoSangrada(f, 0, 0, corte, H)
    ctx.fillStyle = f.c1; ctx.fillRect(corte, 0, 1.2 * u, H)
    const x = corte + 7 * u, mw = W - x - 7 * u
    rotulo(f, marca(f), x, 8 * u, 2.6 * u, alfa(f.tinta, 0.7), { maxW: mw })
    const a = montar(ctx, f.apoio, { min: 0.8, tam: 3.9 * u, largura: mw, altura: 26 * u, fonte: f.corrido(400), lh: 1.45 })
    const b = montar(ctx, f.titulo, { tam: 7.2 * u, largura: mw, altura: H - 40 * u - (a.h ? a.h + 5 * u : 0), fonte: f.leve, lh: 1.1, italicoFinal: 2 })
    const y = (H - b.h - (a.h ? a.h + 5 * u : 0)) / 2
    pintar(ctx, b, x, y, f.tinta, { corItalico: f.destaque })
    pintar(ctx, a, x, y + b.h + 5 * u, alfa(f.tinta, 0.82))
    rotulo(f, f.insta || f.nome, x, H - 9.5 * u, 3 * u, f.tinta, { espacamento: 0.02, peso: 600, maxW: mw })
    return
  }
  ctx.fillStyle = f.c1; bolha(ctx, W * 0.5 + 5 * u, cy + 4 * u, r, 31, 0.1); ctx.fill()
  ctx.fillStyle = f.c2; bolha(ctx, W * 0.5, cy, r, 17, 0.1); ctx.fill()
  const b = montar(ctx, f.titulo, { tam: 7.6 * u, largura: larg, altura: r * 1.25, fonte: f.leve, lh: 1.1, italicoFinal: 2 })
  pintar(ctx, b, W / 2 - larg / 2, cy - b.h / 2, f.claro, { alinhar: 'center', largura: larg, corItalico: destacar(f.c1, f.c2) })
  const ya = Math.min(cy + r + 9 * u, H - 30 * u)
  const a = montar(ctx, f.apoio, { min: 0.8, tam: 4.2 * u, largura: W * 0.76, altura: H - ya - 16 * u, fonte: f.corrido(400), lh: 1.45 })
  pintar(ctx, a, W * 0.12, ya, alfa(f.tinta, 0.82), { alinhar: 'center', largura: W * 0.76 })
  assinar(f, f.tinta)
}

function cartao(f) {
  const { ctx, W, H, u } = f, m = 7 * u, base = H - 16 * u, larg = W - 34 * u
  if (f.foto) fotoDeFundo(f, 0.25)
  else { ctx.fillStyle = f.c2; ctx.fillRect(0, 0, W, H) }
  // com foto, o cartão fica menor e embaixo, deixando a foto aparecer em cima
  const topoCartao = f.foto ? H * 0.42 : m
  ctx.fillStyle = f.papel; retangulo(ctx, m, topoCartao, W - m * 2, base - topoCartao, 2.5 * u); ctx.fill()
  ctx.strokeStyle = alfa(f.tinta, 0.2); ctx.lineWidth = 0.25 * u; retangulo(ctx, m + 2.5 * u, topoCartao + 2.5 * u, W - m * 2 - 5 * u, base - topoCartao - 5 * u, 1.5 * u); ctx.stroke()
  rotulo(f, marca(f), W / 2, topoCartao + 9 * u, 2.6 * u, alfa(f.tinta, 0.65), { alinhar: 'center', maxW: larg })
  const a = montar(ctx, f.apoio, { min: 0.8, tam: 4 * u, largura: larg, altura: f.foto ? 0 : 20 * u, fonte: f.corrido(400), lh: 1.45 })
  const b = montar(ctx, f.titulo, { tam: 8.4 * u, largura: larg, altura: (base - topoCartao) * (f.foto ? 0.55 : 0.5), fonte: f.leve, lh: 1.12, italicoFinal: 3 })
  const total = b.h + (a.h ? 8 * u + a.h : 0), y = topoCartao + (base - topoCartao - total) / 2 + 3 * u
  pintar(ctx, b, 17 * u, y, f.tinta, { alinhar: 'center', largura: larg, corItalico: f.destaque })
  ctx.fillStyle = f.c1; ctx.fillRect(W / 2 - 5 * u, y + b.h + 3.5 * u, 10 * u, 0.5 * u)
  pintar(ctx, a, 17 * u, y + b.h + 8 * u, alfa(f.tinta, 0.82), { alinhar: 'center', largura: larg })
  assinar(f, f.claro, { centro: true })
}

function janela(f) {
  const { ctx, W, H, u } = f, x = 9 * u, w = W - 18 * u, y0 = 14 * u, h = H * (H > W * 1.5 ? 0.42 : 0.38)
  ctx.fillStyle = f.papel; ctx.fillRect(0, 0, W, H)
  if (f.foto) {
    const corte = H * (H > W * 1.5 ? 0.58 : 0.55), escuro = misturar(f.c2, '#000000', 0.1)
    fotoSangrada(f, 0, 0, W, corte, { veuTopo: true })
    ctx.fillStyle = escuro; ctx.fillRect(0, corte, W, H - corte)
    ctx.fillStyle = f.c1; ctx.fillRect(x, corte + 7 * u, 10 * u, 0.6 * u)
    rotulo(f, marca(f), x, 8 * u, 2.8 * u, 'rgba(255,255,255,.85)', { maxW: w })
    const b = montar(ctx, f.titulo, { tam: 8.4 * u, largura: w, altura: (H - corte) - 34 * u, fonte: f.leve, lh: 1.1, italicoFinal: 3 })
    pintar(ctx, b, x, corte + 12 * u, f.claro, { corItalico: misturar(f.c1, '#ffffff', 0.25) })
    const a = montar(ctx, f.apoio, { min: 0.8, tam: 4.2 * u, largura: w * 0.85, altura: H - corte - b.h - 36 * u, fonte: f.corrido(400), lh: 1.45 })
    pintar(ctx, a, x, corte + 12 * u + b.h + 4 * u, alfa(f.claro, 0.85))
    return assinar(f, f.claro)
  } else {
    ctx.save(); retangulo(ctx, x, y0, w, h, 4 * u); ctx.clip()
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, f.c2); g.addColorStop(1, misturar(f.c2, f.c1, 0.65))
    ctx.fillStyle = g; ctx.fillRect(x, y0, w, h)
    ctx.fillStyle = f.claro; circulo(ctx, x + w * 0.72, y0 + h * 0.78, 13 * u); ctx.fill()
    grao(ctx, x, y0, w, h, 0.05, 9)
    ctx.restore()
  }
  rotulo(f, marca(f), x, 8 * u, 2.8 * u, alfa(f.tinta, 0.7), { maxW: w })
  const b = montar(ctx, f.titulo, { tam: 8.4 * u, largura: w, altura: H - y0 - h - 34 * u, fonte: f.leve, lh: 1.1, italicoFinal: 3 })
  pintar(ctx, b, x, y0 + h + 6 * u, f.tinta, { corItalico: f.destaque })
  const a = montar(ctx, f.apoio, { min: 0.8, tam: 4.2 * u, largura: w * 0.85, altura: H - y0 - h - b.h - 30 * u, fonte: f.corrido(400), lh: 1.45 })
  pintar(ctx, a, x, y0 + h + 6 * u + b.h + 4 * u, alfa(f.tinta, 0.82))
  assinar(f, f.tinta)
}

const CAPAS = { papel, arco: arcoCapa, bilhete, cor: corCheia, pergunta, horizonte, ondas, pedra, cartao, janela }

// ---------- páginas de dentro do carrossel: o texto da legenda, uma ideia por página ----------
// Sequência: capa, gancho, um bloco do meio por página, convite e o fecho (artes/texto.js, blocosDoCarrossel).
// As páginas do meio alternam o visual entre si (k = 0, 1, 2...) para não ficarem iguais.

function paginaDaVez(f) {
  const b = f.blocos
  const tipos = ['gancho', ...b.meios.map(() => 'meio'), ...(b.convite ? ['convite'] : []), 'fecho']
  const tipo = tipos[f.pagina - 2] ?? 'fecho'
  const k = f.pagina - 3 // índice da página do meio
  const texto = tipo === 'gancho' ? (b.gancho || f.titulo) : tipo === 'meio' ? b.meios[k] : tipo === 'convite' ? b.convite : ''
  return { tipo, texto, k }
}

// Página do meio com foto (só a primeira): a foto em cima, de borda a borda, e o texto embaixo.
function meioComFoto(f, texto, fundo, cor) {
  const { ctx, W, H, u } = f, x = 9 * u, w = W - 18 * u, corte = H * 0.48
  ctx.fillStyle = fundo; ctx.fillRect(0, 0, W, H)
  fotoSangrada(f, 0, 0, W, corte, { veuTopo: true })
  rotulo(f, marca(f), x, 8 * u, 2.8 * u, 'rgba(255,255,255,.85)')
  const b = montar(ctx, texto, { tam: 5.6 * u, largura: w, altura: H - corte - 30 * u, fonte: f.corrido(400), lh: 1.4 })
  pintar(ctx, b, x, corte + 7 * u, cor)
  assinar(f, cor)
}

// Texto corrido de uma página do meio, centrado na altura entre `topo` e `fundo`.
function textoDoMeio(f, texto, x, topo, fundo, largura, cor, tam = 6.2) {
  const b = montar(f.ctx, texto, { tam: tam * f.u, largura, altura: fundo - topo, fonte: f.corrido(400), lh: 1.42 })
  pintar(f.ctx, b, x, topo + (fundo - topo - b.h) / 2, cor)
}

function internaClara(f, { tipo, texto, k }) {
  const { ctx, W, H, u } = f, x = 9 * u, mw = W - 18 * u
  if (tipo === 'meio' && k === 0 && f.foto) return meioComFoto(f, texto, f.papel, f.tinta)
  if (tipo === 'convite') {
    ctx.fillStyle = f.c2; ctx.fillRect(0, 0, W, H)
    const claro = misturar(f.c1, '#ffffff', 0.55)
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = f.c1; bolha(ctx, W * 0.82, H * 0.2, 30 * u, 11); ctx.fill(); ctx.restore()
    cabecalhoClaro(f, claro)
    const b = montar(ctx, texto, { tam: 8.6 * u, largura: mw, altura: H * 0.46, fonte: f.leve, lh: 1.14, italicoFinal: 3 })
    pintar(ctx, b, x, H * 0.36, claro, { corItalico: f.c1 })
    return assinar(f, claro)
  }
  // fundo: o papel; nas páginas ímpares do meio, um tom mais forte da cor clara (o carrossel respira)
  const forte = tipo === 'meio' && k % 2 === 1
  ctx.fillStyle = forte ? misturar(f.c1, '#ffffff', 0.5) : f.papel; ctx.fillRect(0, 0, W, H)
  // a forma passeia pelas páginas
  const lugares = [[0.1, 0.18, 34], [0.95, 0.55, 30], [0.08, 0.92, 28], [0.92, 0.12, 26], [0.5, 1.02, 30]]
  const [lx, ly, lr] = tipo === 'fecho' ? [0.5, 0.5, 30] : lugares[(f.pagina - 2) % lugares.length]
  if (forte) {
    ctx.save(); ctx.strokeStyle = alfa(f.tinta, 0.4); ctx.lineWidth = 0.35 * u; bolha(ctx, W * lx, H * ly, lr * u, 3 + f.pagina); ctx.stroke(); ctx.restore()
  } else {
    // a forma fica atrás do texto: num tom suave, para a leitura não sofrer
    ctx.fillStyle = tipo === 'fecho' ? f.c1 : misturar(f.papel, f.c1, 0.3); bolha(ctx, W * lx, H * ly, lr * u, 3 + f.pagina); ctx.fill()
    ctx.save(); ctx.strokeStyle = alfa(f.tinta, 0.35); ctx.lineWidth = 0.3 * u; bolha(ctx, W * lx - 4 * u, H * ly - 3 * u, lr * u * 0.98, 21); ctx.stroke(); ctx.restore()
  }
  cabecalhoClaro(f, f.tinta)
  if (tipo === 'gancho') {
    const b = montar(ctx, texto, { tam: 11 * u, largura: mw, altura: H * 0.5, fonte: f.leve, lh: 1.1, italicoFinal: 2 })
    pintar(ctx, b, x, Math.min(H * 0.62 - b.h / 2, H - 22 * u - b.h), f.tinta, { corItalico: f.destaque })
  } else if (tipo === 'meio') {
    if (k % 2 === 0) {
      ctx.font = `${f.voz.leve} ${16 * u}px ${f.voz.fd}`; ctx.fillStyle = alfa(f.tinta, 0.9); ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText('“', x - 1 * u, 18 * u)
      textoDoMeio(f, texto, x, 34 * u, H - 22 * u, mw * 0.9, f.tinta)
    } else {
      textoDoMeio(f, texto, x, 22 * u, H - 22 * u, mw, f.tinta, 6.6)
    }
  } else {
    return fechoDoCarrossel(f, f.tinta, f.destaque, t('arte.fam.salve'))
  }
  assinar(f, f.tinta)
}
function cabecalhoClaro(f, cor) {
  const { ctx, W, u } = f, x = 9 * u
  rotulo(f, f.nome, x, 8 * u, 2.9 * u, alfa(cor, 0.75), { maxW: (W - 18 * u) * 0.7 })
  rotulo(f, marca(f), W - x, 8 * u, 2.9 * u, alfa(cor, 0.75), { alinhar: 'right' })
  ctx.fillStyle = alfa(cor, 0.25); ctx.fillRect(x, 13 * u, W - 18 * u, 0.18 * u)
}
// Última página: o logo (se houver) e o @ ou o nome no meio, com uma frase pequena embaixo.
function fechoDoCarrossel(f, cor, corFrase, frase) {
  const { ctx, W, H, u } = f
  let y = H / 2 - 3 * u
  if (f.temLogo) {
    // a logo só com os nomes, na cor do texto da página
    const marca = logoNaCor(f.logo, cor)
    const [lw, lh] = dimensoes(marca)
    if (lw && lh) { const k = Math.min(0.4 * W / lw, 0.16 * H / lh), w = lw * k, h = lh * k; ctx.drawImage(marca, (W - w) / 2, y - h - 6 * u, w, h) }
  }
  const b = montar(ctx, f.insta || f.nome, { tam: 8.5 * u, largura: W - 18 * u, altura: 20 * u, fonte: f.leve, lh: 1.15 })
  pintar(ctx, b, 9 * u, y - b.h / 2, cor, { alinhar: 'center', largura: W - 18 * u })
  y += b.h / 2 + 4 * u
  rotulo(f, frase, W / 2, y, 3.4 * u, corFrase, { alinhar: 'center', espacamento: 0.02, peso: 600, maxW: W - 18 * u })
}

function internaEscura(f, { tipo, texto, k }) {
  const { ctx, W, H, u } = f, x = 10 * u, mw = W - 20 * u
  const escuro = misturar(f.c2, '#000000', 0.1)
  if (tipo === 'meio' && k === 0 && f.foto) return meioComFoto(f, texto, escuro, f.claro)
  const degrade = (a, b) => { const g = ctx.createLinearGradient(0, 0, W * 0.3, H); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H) }
  const marcar = (cor) => rotulo(f, `${f.pagina}/${f.total}`, W - x, 8 * u, 2.8 * u, alfa(cor, 0.7), { alinhar: 'right' })
  const pe = (cor) => { ctx.fillStyle = alfa(cor, 0.35); ctx.fillRect(x, H - 15 * u, 10 * u, 0.25 * u); assinar(f, cor) }
  if (tipo === 'gancho') {
    degrade(f.claro, misturar(f.c1, '#ffffff', 0.35)); grao(ctx, 0, 0, W, H, 0.05, 3); aspas(f, f.c2, 12 * u, 26); marcar(escuro)
    const b = montar(ctx, texto, { tam: 10 * u, largura: mw, altura: H - 40 * u - 24 * u, fonte: f.frase, lh: 1.12 })
    pintar(ctx, b, x, 40 * u, escuro); return pe(escuro)
  }
  if (tipo === 'meio') {
    // alterna escuro e claro entre as páginas do meio
    if (k % 2 === 0) { fundoEscuroSuave(f); marcar(f.claro); textoDoMeio(f, texto, x, 18 * u, H - 22 * u, mw, f.claro); return pe(f.claro) }
    degrade(misturar(f.c1, '#ffffff', 0.5), f.claro); grao(ctx, 0, 0, W, H, 0.04, 11); marcar(escuro)
    ctx.fillStyle = f.c2; ctx.fillRect(x, 20 * u, 8 * u, 0.6 * u)
    textoDoMeio(f, texto, x, 26 * u, H - 22 * u, mw, escuro)
    return pe(escuro)
  }
  if (tipo === 'convite') {
    const tx = sobre(f.c1, escuro, '#ffffff')
    degrade(f.c1, misturar(f.c1, '#ffffff', 0.3)); grao(ctx, 0, 0, W, H, 0.05, 5); marcar(tx)
    const b = montar(ctx, texto, { tam: 8.6 * u, largura: mw, altura: H * 0.5, fonte: f.frase, lh: 1.15 })
    pintar(ctx, b, x, (H - b.h) / 2 - 4 * u, tx); return pe(tx)
  }
  fundoEscuroSuave(f); marcar(f.claro)
  fechoDoCarrossel(f, f.claro, alfa(f.claro, 0.75), t('arte.fam.siga'))
}

function internaArco(f, { tipo, texto, k }) {
  const { ctx, W, H, u } = f, tintaArco = misturar(f.c2, '#000000', 0.35), luz = misturar(f.c1, '#ffffff', 0.6)
  const ax = 12 * u, aw = W - 24 * u, ay = 12 * u, ah = H - 26 * u, pad = 9 * u
  // texto centrado dentro do arco (da curva ao pé), sem passar do pé; o destaque contrasta com o fundo do arco
  const dentro = (txt, y, h, { tam, fonte, cor, lh = 1.12, italicoFinal = 0, corItalico }) => {
    const topo = y + aw * 0.3, fundo = y + h - 8 * u
    const b = montar(ctx, txt, { tam, largura: aw - pad * 2, altura: fundo - topo, fonte, lh, italicoFinal })
    pintar(ctx, b, ax + pad, topo + (fundo - topo - b.h) / 2, cor, { alinhar: 'center', largura: aw - pad * 2, corItalico })
  }
  const numero = (cor) => rotulo(f, `${f.pagina} / ${f.total}`, W / 2, 5 * u, 2.8 * u, alfa(cor, 0.8), { alinhar: 'center' })
  ctx.fillStyle = f.c2; ctx.fillRect(0, 0, W, H)
  if (tipo === 'convite') {
    ctx.fillStyle = f.c1; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = f.c2; arco(ctx, ax, ay, aw, ah); ctx.fill()
    dentro(texto, ay, ah, { tam: 8 * u, fonte: f.forte, cor: luz, italicoFinal: 3, corItalico: f.c1 })
    numero(sobre(f.c1, tintaArco, '#ffffff'))
    return assinar(f, sobre(f.c1, tintaArco, '#ffffff'))
  }
  numero(luz)
  if (tipo === 'gancho') {
    ctx.strokeStyle = f.c1; ctx.lineWidth = 0.5 * u; arco(ctx, ax, ay, aw, ah); ctx.stroke()
    dentro(texto, ay, ah, { tam: 9.5 * u, fonte: f.forte, cor: luz, italicoFinal: 2, corItalico: f.c1 })
  } else if (tipo === 'meio') {
    if (k === 0 && f.foto) {
      // a foto em cima, de borda a borda; o fundo escuro sobe num arco por cima dela
      const corte = H * 0.5, topoArco = corte - aw * 0.3
      fotoSangrada(f, 0, 0, W, corte + 2, { veuTopo: true })
      ctx.fillStyle = f.c2; ctx.fillRect(0, corte, W, H - corte); arco(ctx, ax, topoArco, aw, H - topoArco); ctx.fill()
      numero('#ffffff')
      const b = montar(ctx, texto, { tam: 5.4 * u, largura: aw - pad * 2, altura: H - topoArco - aw * 0.18 - 24 * u, fonte: f.corrido(500), lh: 1.4 })
      pintar(ctx, b, ax + pad, topoArco + aw * 0.18, luz, { alinhar: 'center', largura: aw - pad * 2 })
    } else if (k % 2 === 0) {
      ctx.fillStyle = f.c1; arco(ctx, ax, ay + 20 * u, aw, ah - 20 * u); ctx.fill()
      ctx.fillStyle = luz; circulo(ctx, W / 2, ay + 11 * u, 6 * u); ctx.fill()
      dentro(texto, ay + 20 * u, ah - 20 * u, { tam: 5.6 * u, fonte: f.corrido(500), cor: sobre(f.c1, tintaArco, '#ffffff'), lh: 1.4 })
    } else {
      // um arco pequeno no alto e o texto claro embaixo
      const w = 22 * u
      ctx.fillStyle = f.c1; arco(ctx, (W - w) / 2, 14 * u, w, 26 * u); ctx.fill()
      textoDoMeio(f, texto, 12 * u, 46 * u, H - 22 * u, W - 24 * u, luz, 5.8)
    }
  } else {
    const w = 44 * u
    ctx.fillStyle = f.c1; arco(ctx, (W - w) / 2, H * 0.22, w, H * 0.4); ctx.fill()
    ctx.fillStyle = luz; circulo(ctx, W / 2 + w / 2 - 2 * u, H * 0.23, 4.5 * u); ctx.fill()
    const b = montar(ctx, f.insta || f.nome, { tam: 7.4 * u, largura: W - 18 * u, altura: 16 * u, fonte: f.forte })
    pintar(ctx, b, 9 * u, H * 0.68, luz, { alinhar: 'center', largura: W - 18 * u })
    if (f.temLogo) logoEm(f)
    return
  }
  assinar(f, luz)
}

// Turismo: página de dentro do carrossel sem formas abstratas. No alto, o número da página e a rota pontilhada com o
// aviãozinho; ao fundo, a palavra-tema da capa bem clarinha; o texto da página em destaque. O convite vai na cor da
// marca; a primeira página do meio com foto mostra a foto (que combina com o texto).
function internaLimpa(f, { tipo, texto, k }) {
  const { ctx, W, H, u } = f, x = 9 * u, mw = W - 18 * u
  if (tipo === 'meio' && k === 0 && f.foto) return meioComFoto(f, texto, f.papel, f.tinta)
  if (tipo === 'fecho') {
    ctx.fillStyle = f.papel; ctx.fillRect(0, 0, W, H)
    return fechoDoCarrossel(f, f.tinta, f.destaque, t('arte.fam.salve'))
  }
  const noConvite = tipo === 'convite'
  const fundo = noConvite ? f.c1 : f.papel
  const tinta = noConvite ? corTexto(f.c1) : f.tinta
  ctx.fillStyle = fundo; ctx.fillRect(0, 0, W, H)
  // a palavra-tema da capa, grande e clarinha, no pé da página
  ctx.save()
  ctx.font = `900 ${24 * u}px ${f.voz.fd}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
  ctx.globalAlpha = 0.12; ctx.fillStyle = tinta
  ctx.fillText(f.palavra, x, H - 40 * u, mw)
  ctx.restore()
  // número da página e a rota com o aviãozinho
  rotulo(f, marca(f), x, 8 * u, 2.8 * u, alfa(tinta, 0.75))
  ctx.save()
  ctx.strokeStyle = alfa(tinta, 0.45); ctx.lineWidth = 0.4 * u; ctx.setLineDash?.([1.4 * u, 1.4 * u])
  ctx.beginPath(); ctx.moveTo(W * 0.42, 9 * u); ctx.bezierCurveTo(W * 0.6, 6 * u, W * 0.72, 12 * u, W - 16 * u, 8 * u); ctx.stroke()
  ctx.restore()
  desenharIcone(ctx, 'aviao', W - 14 * u, 4.5 * u, 6 * u, tinta)
  if (tipo === 'gancho') {
    const b = montar(ctx, texto, { tam: 11 * u, largura: mw, altura: H * 0.5, fonte: f.forte, lh: 1.1, italicoFinal: 2 })
    pintar(ctx, b, x, Math.max(18 * u, (H - b.h) / 2 - 6 * u), tinta, { corItalico: f.destaque })
  } else if (noConvite) {
    const b = montar(ctx, texto, { tam: 8.6 * u, largura: mw, altura: H * 0.46, fonte: f.forte, lh: 1.14 })
    pintar(ctx, b, x, Math.max(18 * u, (H - b.h) / 2 - 6 * u), tinta)
  } else {
    textoDoMeio(f, texto, x, 20 * u, H - 44 * u, mw, tinta, 6.6)
  }
  assinar(f, tinta)
}

function interna(f, item) {
  const vez = paginaDaVez(f)
  // Turismo (com a palavra-tema): páginas limpas, sem bolhas, aspas nem ondas
  if (f.palavra) return internaLimpa(f, vez)
  if (item.id === 'arco') return internaArco(f, vez)
  if (item.id === 'bilhete' || item.tom === 'escuro') return internaEscura(f, vez)
  return internaClara(f, vez)
}

// ---------- desenho ----------

// Desenha a arte `arte` (id da FAMILIA) no ctx. tipo: 'feed', 'stories', 'capa' (capa de vídeo) ou 'car' (carrossel).
// `estilo`: o estilo do ramo (sereno, elegante, sobrio, varejo), que dá as fontes.
export function desenharDaFamilia(ctx, { arte, estilo, pecas, cores, foto = null, logo = null, W, H, tipo, pagina = 1, paginas = 1 }) {
  const item = FAMILIA.find((f) => f.id === arte) ?? FAMILIA[0]
  const f = folha(ctx, { pecas, cores, logo, foto, estilo, W, H, tipo, pagina, paginas })
  ctx.save()
  ctx.clearRect(0, 0, W, H)
  if (tipo === 'car' && pagina > 1) interna(f, item)
  else CAPAS[item.id](f)
  ctx.restore()
}
