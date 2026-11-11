// Vídeos feitos no aparelho, com canvas e MediaRecorder:
// - a montagem de 12 s com as fotos (drawReel + recordReel do v1, em bancada/index.html);
// - a edição do vídeo que o cliente envia: título, assinatura no canto e tela final.
import {
  folha, cobrir, sombrear, rotulo, montarTitulo, pintarTitulo, montarTexto, pintarTexto,
  caixaDeTexto, faixa, enfeiteSuave, assinar,
} from './desenho.js'

export const W_VIDEO = 720
export const H_VIDEO = 1280
const MONTAGEM = 12 // segundos: 3 de título, 3 de gancho, 3 de meio, 3 de tela final
const PARTE = 3
const FIM = 2 // segundos de tela final no vídeo editado
const BITS = 5e6 // 5 Mbps, como no v1

// Na ordem do v1: MP4 (iPhone e Chrome recentes) antes de WebM.
const FORMATOS = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

export function escolherFormato(suporta) {
  const mime = FORMATOS.find((m) => { try { return suporta(m) } catch { return false } })
  return mime ? { mime, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' } : null
}

export function validarDuracao(segundos) {
  if (!Number.isFinite(segundos) || segundos <= 0) return 'invalido'
  return segundos > 60 ? 'longo' : 'ok'
}

export function planoDoVideo(duracao) {
  return { total: duracao + FIM, tituloAte: 3, fimDe: duracao, fimAte: duracao + FIM }
}

export function podeEditarVideo() {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function'
}

// Erro com um código para a tela escolher a mensagem: 'sem-suporte' | 'longo' | 'invalido'.
const erroDeVideo = (codigo) => Object.assign(new Error(`vídeo: ${codigo}`), { codigo })

const suave = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)

// Onde a montagem está no segundo t: parte (0 título, 1 gancho, 2 meio, 3 tela final),
// alfa do texto (fade de entrada e saída), qual foto (-1 sem foto), zoom da foto (0 a 1) e progresso.
// As fotos se repartem nos 9 s antes da tela final, cada uma com o seu zoom lento.
export function momentoDaMontagem(t, nFotos) {
  const parte = Math.min(3, Math.floor(t / PARTE))
  const lt = t - parte * PARTE
  const alfa = Math.max(0, Math.min(1, lt / 0.3) * (parte < 3 ? Math.min(1, (PARTE - lt) / 0.15) : 1))
  const comFotos = MONTAGEM - PARTE, tf = Math.min(t, comFotos)
  let foto = -1, zoom = 0
  if (nFotos > 0) {
    const trecho = comFotos / nFotos
    foto = Math.min(nFotos - 1, Math.floor(tf / trecho))
    zoom = suave(Math.max(0, Math.min(1, (tf - foto * trecho) / trecho)))
  }
  return { parte, alfa, foto, zoom, progresso: Math.min(1, t / MONTAGEM) }
}

// ---------- desenho dos quadros ----------

const medidas = (img) => [img.naturalWidth || img.videoWidth || img.width, img.naturalHeight || img.videoHeight || img.height]

// Tela final: logo, assinatura e o convite, no centro, sobre a cor de fundo (o seg 3 do drawReel).
function telaFinal(f, pecas, logo) {
  const { ctx, W, H, u, look } = f
  const centro = { ...f, alinhar: 'center' }
  ctx.fillStyle = f.b2
  ctx.fillRect(0, 0, W, H)
  enfeiteSuave(f)
  let lw = 0, lh = 0
  if (pecas.assinatura?.logo && logo) {
    const [iw, ih] = medidas(logo)
    if (iw && ih) { lh = Math.min(0.2 * H, 45 * u * ih / iw); lw = lh * iw / ih }
  }
  const nomeTam = lw ? 5.5 * u : 9 * u
  const nome = pecas.assinatura?.texto
    ? montarTexto(centro, pecas.assinatura.texto, nomeTam, nomeTam * 1.2, { fonte: look.fd, peso: look.dw, entrelinha: 1.2, minimo: 0.4 })
    : null
  const frase = pecas.convite || pecas.titulo
  const convite = frase ? montarTexto(centro, frase, 5 * u, 30 * u) : null
  const gapLogo = lw && nome ? 2 * u : 0
  const gapConvite = convite && (lw || nome) ? 4 * u : 0
  let y = (H - (lh + gapLogo + (nome?.h ?? 0) + gapConvite + (convite?.h ?? 0))) / 2
  if (lw) { ctx.drawImage(logo, (W - lw) / 2, y, lw, lh); y += lh + gapLogo }
  if (nome) { pintarTexto(centro, nome, y, f.b2i); y += nome.h }
  y += gapConvite
  if (convite) pintarTexto(centro, convite, y, f.b2i)
}

// Rótulo no alto e o título no meio (o seg 0 do drawReel).
function abertura(f, pecas, tinta) {
  const { u, H } = f
  rotulo(f, pecas.rotulo, 12 * u, tinta)
  const tit = montarTitulo(f, pecas.titulo, 9.5 * u, H - 54 * u)
  pintarTitulo(f, tit, (H - tit.h) / 2, tinta)
}

function comAlfa(ctx, alfa, desenhar) {
  ctx.save()
  ctx.globalAlpha = alfa
  desenhar()
  ctx.restore()
}

// Um quadro da montagem no segundo t (drawReel do v1, sem os selos de promoção).
export function desenharQuadroDeFotos(ctx, { pecas, look, cores, fotos = [], logo = null, W = W_VIDEO, H = H_VIDEO }, t) {
  const f = folha(ctx, { look, cores, W, H })
  const { u } = f
  const m = momentoDaMontagem(t, fotos.length)
  const foto = fotos[m.foto] ?? null
  ctx.save()
  ctx.fillStyle = f.b2
  ctx.fillRect(0, 0, W, H)
  if (foto) { cobrir(ctx, foto, W, H, 1.03 + 0.17 * m.zoom, -0.03 * m.zoom, -0.02 * m.zoom); sombrear(ctx, W, H) }
  else enfeiteSuave(f)
  const tinta = foto ? '#fff' : f.b2i
  const caixa = foto ? {} : { cor: f.b1, tinta: f.b1i }
  const fundo = H - 22 * u, alturaCaixa = fundo - 17 * u
  comAlfa(ctx, m.alfa, () => {
    if (m.parte === 0) abertura(f, pecas, tinta)
    else if (m.parte === 1) caixaDeTexto(f, pecas.gancho || pecas.titulo, fundo, 5.8 * u, alturaCaixa, caixa)
    else if (m.parte === 2) caixaDeTexto(f, pecas.meio || pecas.gancho || pecas.titulo, fundo, 5.8 * u, alturaCaixa, caixa)
    else telaFinal(f, pecas, logo)
  })
  // barra de progresso no alto
  comAlfa(ctx, 0.3, () => { ctx.fillStyle = m.parte === 3 ? f.b2i : tinta; ctx.fillRect(0, 0, W, 1.3 * u) })
  ctx.fillStyle = f.b1
  ctx.fillRect(0, 0, W * m.progresso, 1.3 * u)
  faixa(f)
  if (m.parte < 3) assinar(f, pecas.assinatura, logo, tinta)
  ctx.restore()
}

// Um quadro do vídeo editado no segundo t: o vídeo com o título até 3 s e a assinatura; depois, a tela final.
export function desenharQuadroDoVideo(ctx, { pecas, look, cores, logo = null, video, W = W_VIDEO, H = H_VIDEO }, t, plano) {
  const f = folha(ctx, { look, cores, W, H })
  ctx.save()
  if (t >= plano.fimDe) {
    telaFinal(f, pecas, logo)
  } else {
    ctx.fillStyle = f.b2
    ctx.fillRect(0, 0, W, H)
    cobrir(ctx, video, W, H)
    sombrear(ctx, W, H)
    if (t < plano.tituloAte) {
      const alfa = Math.max(0, Math.min(1, t / 0.3, (plano.tituloAte - t) / 0.15))
      comAlfa(ctx, alfa, () => abertura(f, pecas, '#fff'))
    }
    assinar(f, pecas.assinatura, logo, '#fff')
  }
  faixa(f)
  ctx.restore()
}

// ---------- gravação ----------

function novaTela() {
  const c = document.createElement('canvas')
  c.width = W_VIDEO
  c.height = H_VIDEO
  return c
}

function formatoDoAparelho() {
  if (!podeEditarVideo()) throw erroDeVideo('sem-suporte')
  const formato = escolherFormato((m) => MediaRecorder.isTypeSupported(m))
  if (!formato) throw erroDeVideo('sem-suporte')
  return formato
}

// Grava o canvas (mais as faixas de áudio) enquanto `quadro()` desenha, a cada frame,
// e devolve o segundo atual; para quando ele passar de `total`.
async function gravar(canvas, formato, audios, total, quadro, aoProgredir) {
  const stream = canvas.captureStream(30)
  for (const a of audios) stream.addTrack(a)
  const rec = new MediaRecorder(stream, { mimeType: formato.mime, videoBitsPerSecond: BITS })
  const pedacos = []
  rec.ondataavailable = (e) => { if (e.data.size) pedacos.push(e.data) }
  const parou = new Promise((ok) => { rec.onstop = ok })
  rec.start(500)
  try {
    await new Promise((ok, falha) => {
      const passo = () => {
        try {
          const t = quadro()
          aoProgredir?.(Math.min(1, t / total), canvas)
          if (t < total) requestAnimationFrame(passo)
          else ok()
        } catch (e) { falha(e) }
      }
      requestAnimationFrame(passo)
    })
  } finally {
    rec.stop()
    await parou
    stream.getVideoTracks().forEach((tr) => tr.stop())
  }
  return { blob: new Blob(pedacos, { type: formato.mime.split(';')[0] }), ext: formato.ext }
}

// A montagem de 12 s com as fotos. Quem chama prende as fotos e o logo (prenderImagens)
// até a promessa terminar: os bitmaps são desenhados durante toda a gravação.
export async function montarVideoDeFotos({ pecas, look, cores, fotos = [], logo = null }, aoProgredir) {
  const formato = formatoDoAparelho()
  const canvas = novaTela()
  const ctx = canvas.getContext('2d')
  const opcoes = { pecas, look, cores, fotos: fotos.filter(Boolean), logo }
  desenharQuadroDeFotos(ctx, opcoes, 0)
  let t0 = null
  return gravar(canvas, formato, [], MONTAGEM, () => {
    const agora = performance.now()
    t0 ??= agora
    const t = (agora - t0) / 1000
    desenharQuadroDeFotos(ctx, opcoes, Math.min(t, MONTAGEM - 0.01))
    return t
  }, aoProgredir)
}

function abrirVideo(arquivo) {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.preload = 'auto'
  const url = URL.createObjectURL(arquivo)
  const fechar = () => { video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url) }
  const pronto = new Promise((ok, falha) => {
    video.onloadedmetadata = ok
    video.onerror = () => falha(erroDeVideo('invalido'))
  })
  video.src = url
  return { video, pronto, fechar }
}

// Faixa de áudio do vídeo tocando (Chrome e Firefox; o Safari não captura e o vídeo sai sem som).
function audioDoVideo(video) {
  try {
    const s = video.captureStream?.() ?? video.mozCaptureStream?.()
    return s ? s.getAudioTracks().slice(0, 1) : []
  } catch {
    return []
  }
}

// Edita o vídeo enviado: título nos primeiros 3 s, assinatura no canto e 2 s de tela final.
// `audioExtra` (opcional) substitui o som do vídeo; está reservado para a narração da Etapa 4.
// Erros: `erro.codigo` = 'sem-suporte' | 'longo' | 'invalido'.
export async function editarVideo(arquivo, { pecas, look, cores, logo = null, assinatura }, aoProgredir, audioExtra) {
  const formato = formatoDoAparelho()
  const { video, pronto, fechar } = abrirVideo(arquivo)
  try {
    await pronto
    const validade = validarDuracao(video.duration)
    if (validade !== 'ok') throw erroDeVideo(validade)
    const plano = planoDoVideo(video.duration)
    const canvas = novaTela()
    const ctx = canvas.getContext('2d')
    const opcoes = { pecas: { ...pecas, assinatura: assinatura ?? pecas.assinatura }, look, cores, logo, video }
    video.currentTime = 0
    try { await video.play() } catch { throw erroDeVideo('invalido') }
    const audios = audioExtra ? [audioExtra] : audioDoVideo(video)
    let fimDesde = null
    return await gravar(canvas, formato, audios, plano.total, () => {
      let t
      if (fimDesde === null && !video.ended && video.currentTime < plano.fimDe) t = video.currentTime
      else {
        fimDesde ??= performance.now()
        t = plano.fimDe + (performance.now() - fimDesde) / 1000
      }
      desenharQuadroDoVideo(ctx, opcoes, Math.min(t, plano.fimAte - 0.01), plano)
      return t
    }, aoProgredir)
  } finally {
    fechar()
  }
}
