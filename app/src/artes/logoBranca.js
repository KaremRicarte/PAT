// Logo branca para a marca d'água, mesmo que o cliente tenha enviado a logo colorida. O nome fica branco e forte:
// - fundo transparente com partes claras dentro de uma forma colorida (ex.: nome branco num oval azul): só as partes claras;
// - fundo branco (JPG): o fundo some e o desenho fica; fundo escuro: o fundo some e as partes claras ficam;
// - o resto (uma cor só, ou colorida sem partes brancas): a silhueta inteira.

const luz = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
// deixa o corte nítido: o que passa da metade fica quase todo opaco, o resto quase todo transparente
const nitido = (x) => Math.min(1, Math.max(0, (x - 0.5) * 2.5 + 0.5))

// Pixels RGBA (w×h) da logo → pixels RGBA brancos, com o alfa de cada modo acima.
export function pixelsDaLogoBranca(px, w, h) {
  // a borda diz o fundo: transparente, claro ou escuro
  let borda = 0, transparentes = 0, luzDaBorda = 0
  const naBorda = (i) => { const x = (i / 4) % w, y = Math.floor(i / 4 / w); return x === 0 || y === 0 || x === w - 1 || y === h - 1 }
  let min = 1, max = 0, opacos = 0, claros = 0
  for (let i = 0; i < px.length; i += 4) {
    const opaco = px[i + 3] >= 128, l = luz(px[i], px[i + 1], px[i + 2])
    if (naBorda(i)) { borda++; if (!opaco) transparentes++; else luzDaBorda += l }
    if (!opaco) continue
    opacos++
    if (l > 0.85) claros++
    if (l < min) min = l
    if (l > max) max = l
  }
  const fundoTransparente = !borda || transparentes / borda >= 0.5
  const mediaDaBorda = borda > transparentes ? luzDaBorda / (borda - transparentes) : 0
  const contraste = max - min >= 0.15
  let peso
  if (fundoTransparente) {
    peso = contraste && claros / Math.max(1, opacos) >= 0.03 ? (l) => nitido((l - min) / (max - min)) : () => 1
  } else if (mediaDaBorda >= 0.5) {
    peso = contraste ? (l) => nitido((mediaDaBorda - l) / Math.max(0.01, mediaDaBorda - min)) : () => 1
  } else {
    peso = contraste ? (l) => nitido((l - mediaDaBorda) / Math.max(0.01, max - mediaDaBorda)) : () => 1
  }
  const out = new Uint8ClampedArray(px.length)
  for (let i = 0; i < px.length; i += 4) {
    out[i] = out[i + 1] = out[i + 2] = 255
    out[i + 3] = Math.round((px[i + 3] / 255) * peso(luz(px[i], px[i + 1], px[i + 2])) * 255)
  }
  return out
}

const prontas = new WeakMap()

// A logo branca pronta para desenhar (canvas). Sem canvas (testes) ou se a imagem não deixar ler os pixels, a original.
export function logoBranca(logo) {
  if (!logo) return logo
  if (prontas.has(logo)) return prontas.get(logo)
  let pronta = logo
  try {
    const w = logo.naturalWidth || logo.width, h = logo.naturalHeight || logo.height
    const tela = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h)
      : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: w, height: h }) : null
    const ctx = tela?.getContext('2d')
    if (ctx && w && h) {
      ctx.drawImage(logo, 0, 0, w, h)
      const dados = ctx.getImageData(0, 0, w, h)
      dados.data.set(pixelsDaLogoBranca(dados.data, w, h))
      ctx.putImageData(dados, 0, 0)
      pronta = tela
    }
  } catch (e) {
    console.error(e) // imagem que não deixa ler os pixels: fica a original
  }
  prontas.set(logo, pronta)
  return pronta
}
