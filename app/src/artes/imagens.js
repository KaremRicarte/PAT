// Liga o desenho aos dados: carrega foto e logo do Storage, espera as fontes e gera os PNGs.
import { pecasDaArte, fotoDoPost } from '../cliente/situacao.js'
import { lookDoRamo, fontesDoLook } from './looks.js'
import { medidaDaArte, assinaturaDaArte } from './texto.js'
import { desenharArte } from './desenho.js'
import { montarVideoDeFotos, editarVideo, desenharQuadroDeFotos, W_VIDEO, H_VIDEO } from './video.js'

// Cache das imagens por path, com no máximo LIMITE bitmaps (o usado há mais tempo sai primeiro).
// Quem sai do cache tem o bitmap fechado (close), a não ser que esteja preso por prenderImagens.
const LIMITE = 12
const cache = new Map() // path -> { promessa, bitmap }; a ordem do Map é a do uso
const presos = new Map() // path -> quantas chamadas estão usando
const fecharAoSoltar = new Map() // path -> bitmaps já fora do cache, esperando soltar

function fechar(path, bitmap) {
  if (!bitmap) return
  if (presos.get(path)) fecharAoSoltar.set(path, [...(fecharAoSoltar.get(path) ?? []), bitmap])
  else bitmap.close?.()
}

// Tira do cache os mais antigos já carregados e soltos, até voltar ao limite.
function aparar(poupar) {
  for (const [path, item] of cache) {
    if (cache.size <= LIMITE) return
    if (path === poupar || !item.bitmap || presos.get(path)) continue
    cache.delete(path)
    item.bitmap.close?.()
  }
}

async function baixar(supabase, path) {
  try {
    const { data, error } = await supabase.storage.from('marcas').createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) return null
    const r = await fetch(data.signedUrl)
    if (!r.ok) return null
    return await createImageBitmap(await r.blob())
  } catch {
    return null
  }
}

// Foto ou logo do bucket privado `marcas` (URL assinada de 1 h). null se falhar.
// Quem for desenhar a imagem depois de outro await deve prendê-la antes (prenderImagens).
export function carregarImagem(supabase, path) {
  if (!path) return Promise.resolve(null)
  const achado = cache.get(path)
  if (achado) { cache.delete(path); cache.set(path, achado); return achado.promessa }
  const item = { bitmap: null }
  item.promessa = baixar(supabase, path).then((bitmap) => {
    if (cache.get(path) !== item) return bitmap // esquecida enquanto baixava
    if (!bitmap) { cache.delete(path); return null } // falhou: tenta de novo na próxima vez
    item.bitmap = bitmap
    aparar(path)
    return bitmap
  })
  cache.set(path, item)
  return item.promessa
}

// Prende as imagens enquanto são desenhadas: não saem do cache nem são fechadas.
// Devolve a função que solta.
export function prenderImagens(paths) {
  const lista = paths.filter(Boolean)
  for (const p of lista) presos.set(p, (presos.get(p) ?? 0) + 1)
  let solto = false
  return () => {
    if (solto) return
    solto = true
    for (const p of lista) {
      const n = presos.get(p) - 1
      if (n > 0) { presos.set(p, n); continue }
      presos.delete(p)
      for (const b of fecharAoSoltar.get(p) ?? []) b.close?.()
      fecharAoSoltar.delete(p)
    }
    aparar()
  }
}

// Esquece a imagem guardada (depois de trocar a foto no mesmo path) e fecha o bitmap.
export function esquecerImagem(path) {
  const item = cache.get(path)
  cache.delete(path)
  fechar(path, item?.bitmap)
}

// Fecha todas as imagens e esvazia o cache (ao sair da conta).
export function limparImagens() {
  for (const [path, item] of cache) fechar(path, item.bitmap)
  cache.clear()
}

export async function esperarFontes(look) {
  try { await Promise.all(fontesDoLook(look).map((f) => document.fonts.load(f))) } catch { /* desenha com a fonte reserva */ }
}

// Tudo o que desenharArte precisa para um post (menos o ctx e a página).
async function prepararArte(supabase, post, { negocio, produtos, ramo }) {
  const medida = medidaDaArte(post)
  if (!medida) return null
  const look = lookDoRamo(ramo?.id)
  const pecas = pecasDaArte(post, negocio, ramo)
  const fotoPath = fotoDoPost(post, produtos ?? [], ramo)
  const logoPath = pecas.assinatura.logo ? negocio.logo_path : null
  const soltar = prenderImagens([fotoPath, logoPath]) // quem chama solta depois de desenhar
  const [foto, logo] = await Promise.all([
    carregarImagem(supabase, fotoPath),
    carregarImagem(supabase, logoPath),
    esperarFontes(look),
  ])
  pecas.assinatura = assinaturaDaArte(pecas.assinatura, Boolean(logo), negocio.nome)
  return {
    ...medida,
    soltar,
    opcoes: {
      pecas, look, cores: { cor1: negocio.cor1, cor2: negocio.cor2 }, foto, logo,
      W: medida.W, H: medida.H, paginas: medida.paginas, capaDeVideo: post.tipo === 'video',
    },
  }
}

function novaTela(W, H) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  return c
}

const paraPng = (canvas) => new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('PNG não gerado'))), 'image/png'))

// Um canvas por página da arte, no tamanho real (a arte grande da tela do post). [] se o post não tem arte.
export async function desenharPaginas(supabase, post, ctxDados) {
  const arte = await prepararArte(supabase, post, ctxDados)
  if (!arte) return []
  const telas = []
  try {
    for (let pagina = 1; pagina <= arte.paginas; pagina++) {
      const c = novaTela(arte.W, arte.H)
      desenharArte(c.getContext('2d'), { ...arte.opcoes, pagina })
      telas.push(c)
    }
  } finally {
    arte.soltar()
  }
  return telas
}

// PNG de cada página da arte, para "Baixar imagem". [] se o post não tem arte.
export async function gerarImagens(supabase, post, ctxDados) {
  return Promise.all((await desenharPaginas(supabase, post, ctxDados)).map(paraPng))
}

// A página 1 da arte, reduzida para `largura`. null se o post não tem arte.
export async function miniatura(supabase, post, ctxDados, largura = 240) {
  const arte = await prepararArte(supabase, post, ctxDados)
  if (!arte) return null
  const grande = novaTela(arte.W, arte.H)
  try {
    desenharArte(grande.getContext('2d'), { ...arte.opcoes, pagina: 1 })
  } finally {
    arte.soltar()
  }
  const pequena = novaTela(largura, Math.round(largura * arte.H / arte.W))
  const ctx = pequena.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(grande, 0, 0, pequena.width, pequena.height)
  return pequena
}

// O que os vídeos do post precisam: textos, estilo, cores, logo e as fotos (paths).
// Fotos e logo ficam presos até soltar(): os bitmaps são desenhados durante toda a gravação.
async function prepararVideo(supabase, post, { negocio, produtos, ramo }, fotoPaths) {
  const look = lookDoRamo(ramo?.id)
  const pecas = pecasDaArte(post, negocio, ramo)
  const paths = (fotoPaths ?? [fotoDoPost(post, produtos ?? [], ramo)]).filter(Boolean)
  const logoPath = pecas.assinatura.logo ? negocio.logo_path : null
  const soltar = prenderImagens([...paths, logoPath])
  const [logo, , ...fotos] = await Promise.all([
    carregarImagem(supabase, logoPath),
    esperarFontes(look),
    ...paths.map((p) => carregarImagem(supabase, p)),
  ])
  pecas.assinatura = assinaturaDaArte(pecas.assinatura, Boolean(logo), negocio.nome)
  return { soltar, opcoes: { pecas, look, cores: { cor1: negocio.cor1, cor2: negocio.cor2 }, logo, fotos: fotos.filter(Boolean) } }
}

// Montagem de 12 s com as fotos do post (sem fotoPaths, a foto do post).
export async function gerarVideoDeFotos(supabase, post, ctxDados, fotoPaths, aoProgredir) {
  const { soltar, opcoes } = await prepararVideo(supabase, post, ctxDados, fotoPaths)
  try {
    return await montarVideoDeFotos(opcoes, aoProgredir)
  } finally {
    soltar()
  }
}

// Prévia animada da montagem num canvas, repetindo os 12 s até parar() (ou o canvas sair da página).
// Com movimento reduzido no aparelho, fica parada no título. Devolve { canvas, parar }.
export async function previaDaMontagem(supabase, post, ctxDados) {
  const { soltar, opcoes } = await prepararVideo(supabase, post, ctxDados)
  const canvas = novaTela(W_VIDEO, H_VIDEO)
  const ctx = canvas.getContext('2d')
  let pedido = null, t0 = null, parada = false
  const parar = () => {
    if (parada) return
    parada = true
    if (pedido !== null) cancelAnimationFrame(pedido)
    soltar()
  }
  desenharQuadroDeFotos(ctx, opcoes, 1.5)
  const reduzido = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduzido) { parar(); return { canvas, parar } } // o quadro já está desenhado: pode soltar as imagens
  const passo = (agora) => {
    if (parada) return
    if (t0 !== null && !canvas.isConnected) return parar() // saiu da tela
    t0 ??= agora
    desenharQuadroDeFotos(ctx, opcoes, ((agora - t0) / 1000) % 12)
    pedido = requestAnimationFrame(passo)
  }
  pedido = requestAnimationFrame(passo)
  return { canvas, parar }
}

// O vídeo enviado pelo cliente, com título, assinatura e tela final. Erros: ver editarVideo.
// opcoesDeAudio = { audioCtx, audioExtra }: o audioCtx vem de criarAudioDoGesto(), feito no clique.
export async function gerarVideoEditado(supabase, post, ctxDados, arquivo, aoProgredir, opcoesDeAudio) {
  const { soltar, opcoes } = await prepararVideo(supabase, post, ctxDados, [])
  try {
    const { pecas, look, cores, logo } = opcoes
    return await editarVideo(arquivo, { pecas, look, cores, logo, assinatura: pecas.assinatura }, aoProgredir, opcoesDeAudio)
  } finally {
    soltar()
  }
}
