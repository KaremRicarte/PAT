// Liga o desenho aos dados: carrega foto e logo do Storage, espera as fontes e gera os PNGs.
import { pecasDaArte, fotoDoPost } from '../cliente/situacao.js'
import { lookDoRamo, fontesDoLook } from './looks.js'
import { medidaDaArte, assinaturaDaArte } from './texto.js'
import { desenharArte } from './desenho.js'

const cache = new Map() // path -> Promise<ImageBitmap|null>

// Foto ou logo do bucket privado `marcas` (URL assinada de 1 h). null se falhar.
export function carregarImagem(supabase, path) {
  if (!path) return Promise.resolve(null)
  if (!cache.has(path)) {
    const p = (async () => {
      try {
        const { data, error } = await supabase.storage.from('marcas').createSignedUrl(path, 3600)
        if (error || !data?.signedUrl) return null
        const r = await fetch(data.signedUrl)
        if (!r.ok) return null
        return await createImageBitmap(await r.blob())
      } catch {
        return null
      }
    })()
    cache.set(path, p)
    p.then((img) => { if (!img) cache.delete(path) }) // falhou: tenta de novo na próxima vez
  }
  return cache.get(path)
}

// Esquece a imagem guardada (depois de trocar a foto no mesmo path).
export function esquecerImagem(path) {
  cache.delete(path)
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
  const querLogo = pecas.assinatura.logo && negocio.logo_path
  const [foto, logo] = await Promise.all([
    carregarImagem(supabase, fotoDoPost(post, produtos ?? [], ramo)),
    querLogo ? carregarImagem(supabase, negocio.logo_path) : null,
    esperarFontes(look),
  ])
  pecas.assinatura = assinaturaDaArte(pecas.assinatura, Boolean(logo), negocio.nome)
  return {
    ...medida,
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

// PNG de cada página da arte, para "Baixar imagem". [] se o post não tem arte.
export async function gerarImagens(supabase, post, ctxDados) {
  const arte = await prepararArte(supabase, post, ctxDados)
  if (!arte) return []
  const blobs = []
  for (let pagina = 1; pagina <= arte.paginas; pagina++) {
    const c = novaTela(arte.W, arte.H)
    desenharArte(c.getContext('2d'), { ...arte.opcoes, pagina })
    blobs.push(await paraPng(c))
  }
  return blobs
}

// A página 1 da arte, reduzida para `largura`. null se o post não tem arte.
export async function miniatura(supabase, post, ctxDados, largura = 240) {
  const arte = await prepararArte(supabase, post, ctxDados)
  if (!arte) return null
  const grande = novaTela(arte.W, arte.H)
  desenharArte(grande.getContext('2d'), { ...arte.opcoes, pagina: 1 })
  const pequena = novaTela(largura, Math.round(largura * arte.H / arte.W))
  const ctx = pequena.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(grande, 0, 0, pequena.width, pequena.height)
  return pequena
}
