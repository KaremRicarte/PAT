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

// Erro com um código para a tela escolher a mensagem (a lista está em editarVideo).
const erroDeVideo = (codigo) => Object.assign(new Error(`vídeo: ${codigo}`), { codigo })

// Código de qualquer erro da gravação: mantém o que já tem; autoplay recusado vira 'sem-permissao';
// o resto (MediaRecorder, canvas…) vira 'falhou'.
export function codigoDoErro(erro) {
  if (erro?.codigo) return erro.codigo
  return erro?.name === 'NotAllowedError' ? 'sem-permissao' : 'falhou'
}

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

// Onde o vídeo enviado entra na tela W×H. Vertical: cobre a tela (cortando o que sobra).
// Horizontal ou quadrado: inteiro, na largura toda e centralizado na vertical.
// null enquanto o vídeo não tem quadro.
export function enquadramento(larguraVideo, alturaVideo, W, H) {
  if (!larguraVideo || !alturaVideo) return null
  const s = larguraVideo >= alturaVideo ? W / larguraVideo : Math.max(W / larguraVideo, H / alturaVideo)
  const w = larguraVideo * s, h = alturaVideo * s
  return { x: (W - w) / 2, y: (H - h) / 2, w, h }
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
    const r = enquadramento(video.videoWidth, video.videoHeight, W, H)
    if (r) ctx.drawImage(video, r.x, r.y, r.w, r.h)
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

// Devolve a memória do canvas da gravação (no iPhone a memória de canvas é curta).
function soltarCanvas(c) {
  c.width = 0
  c.height = 0
}

// Pede para a tela não apagar durante a gravação (Screen Wake Lock). null se o navegador
// não tem ou recusou: a gravação segue, e a dica "Mantenha a tela aberta" continua valendo.
export async function manterTelaAcesa(nav = globalThis.navigator) {
  try { return (await nav?.wakeLock?.request('screen')) ?? null } catch { return null }
}

export function soltarTela(trava) {
  try { trava?.release()?.catch?.(() => {}) } catch { /* já solta */ }
}

function formatoDoAparelho() {
  if (!podeEditarVideo()) throw erroDeVideo('sem-suporte')
  const formato = escolherFormato((m) => MediaRecorder.isTypeSupported(m))
  if (!formato) throw erroDeVideo('sem-suporte')
  return formato
}

// Grava o canvas (mais as faixas de áudio). `aoComecar(falhar)` roda logo depois de rec.start
// (ex.: dar play no vídeo e vigiar os erros dele); `quadro()` desenha a cada frame e devolve o segundo atual.
// Para quando o segundo passa de `total`. Se a tela for para segundo plano, aborta ('interrompido').
// Para sempre as faixas do canvas; as de áudio são de quem chama.
async function gravar({ canvas, formato, audios = [], total, quadro, aoProgredir, aoComecar }) {
  const trava = await manterTelaAcesa() // a tela não apaga no meio (o iPhone apaga em 30 s sem toque)
  const stream = canvas.captureStream(30)
  for (const a of audios) stream.addTrack(a)
  let terminar, falhar, rec = null, pedidoDeQuadro = null
  const fim = new Promise((ok, erro) => { terminar = ok; falhar = erro })
  fim.catch(() => {}) // a falha é tratada no await abaixo
  const aoEsconder = () => { if (document.hidden) falhar(erroDeVideo('interrompido')) }
  const pedacos = []
  try {
    document.addEventListener('visibilitychange', aoEsconder)
    aoEsconder()
    rec = new MediaRecorder(stream, { mimeType: formato.mime, videoBitsPerSecond: BITS })
    rec.ondataavailable = (e) => { if (e.data.size) pedacos.push(e.data) }
    rec.onerror = () => falhar(erroDeVideo('falhou'))
    rec.start(500)
    await aoComecar?.(falhar)
    const passo = () => {
      try {
        const t = quadro()
        aoProgredir?.(Math.min(1, t / total), canvas)
        if (t < total) pedidoDeQuadro = requestAnimationFrame(passo)
        else terminar()
      } catch (e) { falhar(e) }
    }
    pedidoDeQuadro = requestAnimationFrame(passo)
    await fim
    const parou = new Promise((ok) => { rec.onstop = ok })
    rec.stop()
    await parou
    return { blob: new Blob(pedacos, { type: formato.mime.split(';')[0] }), ext: formato.ext }
  } catch (e) {
    throw erroDeVideo(codigoDoErro(e))
  } finally {
    if (pedidoDeQuadro !== null) cancelAnimationFrame(pedidoDeQuadro)
    document.removeEventListener('visibilitychange', aoEsconder)
    if (rec && rec.state !== 'inactive') { try { rec.stop() } catch { /* já parado */ } }
    stream.getVideoTracks().forEach((tr) => tr.stop())
    soltarTela(trava)
  }
}

// A montagem de 12 s com as fotos. Quem chama prende as fotos e o logo (prenderImagens)
// até a promessa terminar: os bitmaps são desenhados durante toda a gravação.
// Erros: `erro.codigo` = 'sem-suporte' | 'interrompido' | 'falhou'.
export async function montarVideoDeFotos({ pecas, look, cores, fotos = [], logo = null }, aoProgredir) {
  const formato = formatoDoAparelho()
  const canvas = novaTela()
  const ctx = canvas.getContext('2d')
  const opcoes = { pecas, look, cores, fotos: fotos.filter(Boolean), logo }
  desenharQuadroDeFotos(ctx, opcoes, 0)
  let t0 = null
  try {
    return await gravar({
      canvas, formato, total: MONTAGEM, aoProgredir,
      quadro: () => {
        const agora = performance.now()
        t0 ??= agora
        const t = (agora - t0) / 1000
        desenharQuadroDeFotos(ctx, opcoes, Math.min(t, MONTAGEM - 0.01))
        return t
      },
    })
  } finally {
    soltarCanvas(canvas)
  }
}

const LIMITE_ABRIR = 15000 // ms sem metadados = vídeo que o navegador não abre
const LIMITE_PARADO = 2000 // ms pausado sem ter acabado = gravação travada

// Cria o <video> da edição. Chame de forma SÍNCRONA dentro do toque do usuário, antes de qualquer
// await: o iOS só deixa tocar com som (e fora da tela) um <video> que já recebeu play() num gesto.
// Fica anexado à página, invisível (1 px, quase transparente), até editarVideo terminar e tirá-lo.
// O src do arquivo entra depois, em editarVideo. Quem cria e não chega a editar tira com video.remove().
export function criarVideoDoGesto() {
  const video = document.createElement('video')
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('aria-hidden', 'true')
  video.muted = false
  video.preload = 'auto'
  Object.assign(video.style, { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', opacity: '0.01', pointerEvents: 'none' })
  document.body.append(video)
  try { video.load() } catch { /* sem src ainda */ }
  // play() no gesto destrava o elemento; o pause() logo em seguida impede que o arquivo, quando
  // chegar, comece a tocar sozinho (e com som) antes de a gravação ligar o som ao Web Audio.
  try { video.play()?.catch?.(() => {}) } catch { /* sem src: o play só destrava o elemento */ }
  try { video.pause() } catch { /* nada tocando */ }
  return video
}

// O <video> não fica muted quando o som passa pelo Web Audio (senão a gravação sai muda).
// O som vai só para o grafo, nunca para audioCtx.destination, então nada toca no alto-falante.
// doGesto: o <video> de criarVideoDoGesto(); sem ele, um é criado aqui (fora do toque: pode ser recusado no iPhone).
function abrirVideo(arquivo, doGesto = null) {
  const video = doGesto ?? criarVideoDoGesto()
  const url = URL.createObjectURL(arquivo)
  let limite = null
  const pronto = new Promise((ok, falha) => {
    limite = setTimeout(() => falha(erroDeVideo('invalido')), LIMITE_ABRIR)
    video.onloadedmetadata = () => { clearTimeout(limite); ok() }
    video.onerror = () => { clearTimeout(limite); falha(erroDeVideo('invalido')) }
  })
  pronto.catch(() => {}) // tratado por quem espera `pronto`
  const fechar = () => {
    clearTimeout(limite)
    video.onerror = null
    video.pause()
    video.removeAttribute('src')
    video.load()
    video.remove()
    URL.revokeObjectURL(url)
  }
  video.pause()
  video.src = url
  return { video, pronto, fechar }
}

// Cria o AudioContext do vídeo. Chame de forma SÍNCRONA dentro do clique do usuário:
// assim o Safari deixa tocar o som depois dos awaits. null se o navegador não tem Web Audio.
// Quem cria fecha (audioCtx.close()) depois que editarVideo terminar.
export function criarAudioDoGesto() {
  const Contexto = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (!Contexto) return null
  try {
    const audioCtx = new Contexto()
    audioCtx.resume?.()?.catch?.(() => {})
    return audioCtx
  } catch {
    return null
  }
}

// Liga o som do vídeo (e o audioExtra, misturado) a um destino de gravação, sem passar pelo alto-falante.
function ligarSom(audioCtx, video, audioExtra) {
  const dest = audioCtx.createMediaStreamDestination()
  const fonte = audioCtx.createMediaElementSource(video)
  fonte.connect(dest)
  const nos = [fonte]
  if (audioExtra) {
    const extra = audioCtx.createMediaStreamSource(new MediaStream([audioExtra]))
    const volume = audioCtx.createGain()
    extra.connect(volume)
    volume.connect(dest)
    nos.push(extra, volume)
  }
  audioCtx.resume?.()?.catch?.(() => {}) // sem await: fora do gesto, o resume pode ficar pendente
  return {
    faixas: dest.stream.getAudioTracks(),
    desligar: () => {
      for (const n of nos) { try { n.disconnect() } catch { /* já desligado */ } }
      dest.stream.getTracks().forEach((tr) => tr.stop())
    },
  }
}

// Edita o vídeo enviado: título nos primeiros 3 s, assinatura no canto e 2 s de tela final.
// O som vai pelo Web Audio. `audioCtx` deve vir de criarAudioDoGesto(), criado dentro do clique,
// e quem o passa é quem o fecha. Sem ele, um é criado aqui (plano B) e fechado no fim.
// `audioExtra` (reservado para a narração da Etapa 4) é misturado ao som do vídeo e não é parado aqui.
// `video`: o <video> de criarVideoDoGesto(), criado no toque; editarVideo põe o src e o tira da página no fim
// (mesmo se der erro). Sem ele, um é criado aqui.
// Erros: `erro.codigo` = 'sem-suporte' | 'longo' | 'invalido' | 'sem-permissao' | 'interrompido' | 'falhou'.
export async function editarVideo(arquivo, { pecas, look, cores, logo = null, assinatura }, aoProgredir, { audioCtx, audioExtra, video: doGesto } = {}) {
  let formato
  try { formato = formatoDoAparelho() } catch (e) { doGesto?.remove(); throw e }
  const audioProprio = audioCtx ? null : criarAudioDoGesto()
  const contexto = audioCtx ?? audioProprio
  const { video, pronto, fechar } = abrirVideo(arquivo, doGesto)
  let som = null, canvas = null
  try {
    await pronto
    const validade = validarDuracao(video.duration)
    if (validade !== 'ok') throw erroDeVideo(validade)
    const plano = planoDoVideo(video.duration)
    canvas = novaTela()
    const ctx = canvas.getContext('2d')
    const opcoes = { pecas: { ...pecas, assinatura: assinatura ?? pecas.assinatura }, look, cores, logo, video }
    if (contexto) { try { som = ligarSom(contexto, video, audioExtra) } catch { som = null } }
    video.muted = !som // sem o grafo, o som iria para o alto-falante
    video.currentTime = 0
    let fimDesde = null, paradoDesde = null
    return await gravar({
      canvas, formato, audios: som?.faixas ?? [], total: plano.total, aoProgredir,
      aoComecar: async (falhar) => {
        video.onerror = () => falhar(erroDeVideo('invalido'))
        try { await video.play() } catch (e) {
          throw erroDeVideo(e?.name === 'NotAllowedError' ? 'sem-permissao' : 'invalido')
        }
      },
      quadro: () => {
        const agora = performance.now()
        let t
        if (fimDesde === null && !video.ended && video.currentTime < plano.fimDe) {
          if (video.paused) {
            paradoDesde ??= agora
            if (agora - paradoDesde > LIMITE_PARADO) throw erroDeVideo('falhou')
          } else paradoDesde = null
          t = video.currentTime
        } else {
          fimDesde ??= agora
          t = plano.fimDe + (agora - fimDesde) / 1000
        }
        desenharQuadroDoVideo(ctx, opcoes, Math.min(t, plano.fimAte - 0.01), plano)
        return t
      },
    })
  } catch (e) {
    throw erroDeVideo(codigoDoErro(e))
  } finally {
    som?.desligar()
    fechar()
    if (canvas) soltarCanvas(canvas)
    if (audioProprio) { try { audioProprio.close()?.catch?.(() => {}) } catch { /* já fechado */ } }
  }
}
