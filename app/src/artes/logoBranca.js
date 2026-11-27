// Logo branca para a marca d'água, mesmo que o cliente tenha enviado a logo colorida.
// Versão "vazada": o que é escuro ou colorido vira branco e o que é claro fica transparente, para um texto branco sobre
// um fundo colorido (ex.: nome dentro de um oval) continuar aparecendo como recorte. Logo de uma cor só vira silhueta.

const luz = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

// Pixels RGBA da logo → pixels RGBA brancos, com o alfa calculado como acima.
export function pixelsDaLogoBranca(px) {
  let min = 1, max = 0
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue
    const l = luz(px[i], px[i + 1], px[i + 2])
    if (l < min) min = l
    if (l > max) max = l
  }
  const silhueta = max - min < 0.15
  const out = new Uint8ClampedArray(px.length)
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255
    const peso = silhueta ? 1 : Math.min(1, Math.max(0, ((max - luz(px[i], px[i + 1], px[i + 2])) / (max - min)) * 1.25))
    out[i] = out[i + 1] = out[i + 2] = 255
    out[i + 3] = Math.round(a * peso * 255)
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
      dados.data.set(pixelsDaLogoBranca(dados.data))
      ctx.putImageData(dados, 0, 0)
      pronta = tela
    }
  } catch (e) {
    console.error(e) // imagem que não deixa ler os pixels: fica a original
  }
  prontas.set(logo, pronta)
  return pronta
}
