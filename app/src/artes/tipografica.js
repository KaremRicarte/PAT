// Arte tipográfica (Turismo, post sem foto): só texto, mas montado como peça gráfica.
// - ao fundo, a palavra-tema do post bem grande, repetida (cheia e vazada intercaladas);
// - no alto, uma rota pontilhada com um aviãozinho;
// - no meio, um balão de fala branco com o título do post (o fim em negrito, na cor da marca).
import { quebrarLinhas, contrasteBom } from './texto.js'
import { sorte, hashTexto } from './familia.js'
import { assinar, desenharIcone } from './desenho.js'

const sem = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// A palavra do fundo, pelo tipo de conteúdo do post (pilar e título).
export function palavraDoFundo(post, { enquete = false } = {}) {
  const t = sem(post.titulo ?? '')
  if (enquete) return 'pergunta'
  if (post.pilar === 'need') return 'atenção'
  if (post.pilar === 'demo') return '#partiu'
  if (/\b(lembr|nao esqueca|nao se atrase|nao deixe)/.test(t)) return 'lembrete'
  if (/\b(checklist|o que levar|documentos que)/.test(t)) return 'checklist'
  if (/^\d+\s/.test(t.trim())) return 'lista'
  if (/\b(dica|peso ideal|bagagem|melhor epoca)/.test(t)) return 'dica'
  if (/\bmotivos?\b/.test(t)) return 'motivos'
  if (/\b(conta como foi|viajou com a gente)/.test(t)) return 'clientes'
  if (/\b(sabia|curiosidade)/.test(t)) return 'curiosidade'
  if (/\bbastidor/.test(t)) return 'bastidores'
  if (/\b(equipe|nosso time)/.test(t)) return 'equipe'
  if (/\bhistoria\b/.test(t)) return 'nossa história'
  if (/\bclientes?\b/.test(t)) return 'clientes'
  if (t.trim().endsWith('?')) return 'pergunta'
  return '#partiu'
}

const comCor = (ctx, cor, fn) => { ctx.save(); ctx.fillStyle = cor; ctx.strokeStyle = cor; fn(); ctx.restore() }

// Rota pontilhada com o aviãozinho no fim (no alto da arte).
function rota(f, y, cor) {
  const { ctx, W, u } = f
  ctx.save()
  ctx.strokeStyle = cor
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 0.45 * u
  ctx.setLineDash?.([1.6 * u, 1.6 * u])
  ctx.beginPath()
  ctx.moveTo(-2 * u, y + 4 * u)
  ctx.bezierCurveTo(W * 0.25, y - 4 * u, W * 0.55, y + 6 * u, W - 16 * u, y)
  ctx.stroke()
  ctx.restore()
  comCor(ctx, cor, () => desenharIcone(ctx, 'aviao', W - 14 * u, y - 3.5 * u, 7 * u, cor))
}

// O título em linhas, com as palavras do fim destacadas: [{ palavras: [{ t, destaque }] }].
function linhasDoTitulo(ctx, titulo, largura, tam, fonte) {
  const palavras = titulo.split(/\s+/).filter(Boolean)
  const corte = Math.max(1, Math.floor(palavras.length * 0.6)) // as últimas ~40% em destaque
  ctx.font = `800 ${tam}px ${fonte}`
  const linhas = quebrarLinhas(titulo, largura, (s) => ctx.measureText(s).width)
  let i = 0
  return linhas.map((l) => l.split(' ').map((t) => ({ t, destaque: i++ >= corte })))
}

export function arteTipografica(f, { pecas, logo, rotuloTexto }) {
  const { ctx, W, H, u, look } = f
  const r = sorte(hashTexto(pecas.titulo ?? ''))
  const fundo = f.b2
  // a palavra do fundo é enfeite: sempre na cor principal da marca; os destaques do balão também, se ela se lê no branco
  const forte = f.b1
  const destaque = contrasteBom(f.b1, '#FFFFFF') ? f.b1 : '#111111'
  ctx.fillStyle = fundo
  ctx.fillRect(0, 0, W, H)

  // a palavra-tema bem grande, repetida, ocupando a arte
  const palavra = pecas.palavra
  const margem = 6 * u
  ctx.font = `900 ${20 * u}px ${look.fd}`
  const larg = ctx.measureText(palavra).width
  const tam = Math.min(26 * u, (20 * u) * (W - 2 * margem) / larg)
  const passo = tam * 0.98
  const topo = 15 * u, fim = H - 16 * u
  // as linhas preenchem do alto até a assinatura
  const linhas = Math.max(3, Math.round((fim - topo) / passo))
  // a última linha termina (com as letras que descem, como ç, g e p) antes da assinatura
  const passoFinal = (fim - topo - tam * 1.15) / (linhas - 1)
  ctx.save()
  ctx.font = `900 ${tam}px ${look.fd}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.lineWidth = Math.max(1, 0.35 * u)
  const desloca = r() < 0.5 ? 0 : 1
  for (let i = 0; i < linhas; i++) {
    const y = topo + i * passoFinal
    if ((i + desloca) % 2 === 0) { ctx.fillStyle = forte; ctx.globalAlpha = 0.95; ctx.fillText(palavra, margem, y, W - 2 * margem) }
    else { ctx.strokeStyle = forte; ctx.globalAlpha = 0.45; ctx.strokeText(palavra, margem, y, W - 2 * margem) }
  }
  ctx.restore()

  rota(f, 8 * u, forte)
  if (rotuloTexto) comCor(ctx, forte, () => { ctx.font = `700 ${3 * u}px ${look.fd}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(rotuloTexto, margem, 3 * u, W * 0.5) })

  // o balão com o título
  const bw = W * 0.68, pad = 5 * u
  const fb = look.fd
  let tt = 7 * u, linhasT
  for (let i = 0; i < 20; i++) {
    linhasT = linhasDoTitulo(ctx, pecas.titulo ?? '', bw - pad * 2, tt, fb)
    if (linhasT.length * tt * 1.2 <= H * 0.42) break
    tt *= 0.93
  }
  const bh = pad * 2 + linhasT.length * tt * 1.2
  const bx = r() < 0.5 ? W - bw - 7 * u : 7 * u
  const by = Math.max(topo + passo * 0.6, Math.min((H - bh) / 2, fim - bh - 6 * u))
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = 3 * u; ctx.shadowOffsetY = 1.2 * u
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 4 * u); else ctx.rect(bx, by, bw, bh)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  // o rabinho do balão
  const rx = bx + (bx < W / 2 ? 0.22 : 0.78) * bw
  ctx.beginPath(); ctx.moveTo(rx - 3.5 * u, by + bh - 1); ctx.lineTo(rx, by + bh + 5 * u); ctx.lineTo(rx + 3.5 * u, by + bh - 1); ctx.closePath(); ctx.fill()
  ctx.restore()
  // contorno na cor da marca (como as bordas dos balões das referências)
  ctx.save()
  ctx.strokeStyle = forte; ctx.lineWidth = 0.7 * u
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 4 * u); else ctx.rect(bx, by, bw, bh)
  ctx.stroke()
  ctx.restore()
  // o texto do balão, centralizado; o fim em negrito na cor forte
  ctx.save()
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const escuro = '#111111'
  linhasT.forEach((linha, i) => {
    const pedacos = linha.map((p, j) => ({ ...p, t: j < linha.length - 1 ? `${p.t} ` : p.t }))
    const larguras = pedacos.map((p) => { ctx.font = `${p.destaque ? 900 : 600} ${tt}px ${fb}`; return ctx.measureText(p.t).width })
    const total = larguras.reduce((a, b) => a + b, 0)
    const escala = Math.min(1, (bw - pad * 2) / total)
    let x = bx + (bw - total * escala) / 2
    const y = by + pad + i * tt * 1.2
    pedacos.forEach((p, j) => {
      ctx.font = `${p.destaque ? 900 : 600} ${tt}px ${fb}`
      ctx.fillStyle = p.destaque ? destaque : escuro
      ctx.fillText(p.t.trimEnd(), x, y, larguras[j] * escala)
      x += larguras[j] * escala
    })
  })
  ctx.restore()

  assinar(f, pecas.assinatura, logo, f.b2i, f.b2i)
}
