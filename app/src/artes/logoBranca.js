// Logo branca para a marca d'água, mesmo que o cliente tenha enviado a logo colorida. O nome fica branco e forte:
// - fundo transparente com partes claras dentro de uma forma colorida (ex.: nome branco num oval azul): só as partes claras;
// - fundo branco (JPG): o fundo some e o desenho fica; fundo escuro: o fundo some e as partes claras ficam;
// - o resto (uma cor só, ou colorida sem partes brancas): a silhueta inteira.
// Depois, só os nomes ficam: símbolos e molduras saem (soOsNomes).

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
    // só o branco de verdade (todas as cores altas): faixas e formas coloridas, mesmo claras, saem
    peso = contraste && claros / Math.max(1, opacos) >= 0.03 ? (_l, branco) => Math.min(1, Math.max(0, (branco - 0.6) / 0.3)) : () => 1
  } else if (mediaDaBorda >= 0.5) {
    peso = contraste ? (l) => nitido((mediaDaBorda - l) / Math.max(0.01, mediaDaBorda - min)) : () => 1
  } else {
    peso = contraste ? (l) => nitido((l - mediaDaBorda) / Math.max(0.01, max - mediaDaBorda)) : () => 1
  }
  const out = new Uint8ClampedArray(px.length)
  for (let i = 0; i < px.length; i += 4) {
    out[i] = out[i + 1] = out[i + 2] = 255
    out[i + 3] = Math.round((px[i + 3] / 255) * peso(luz(px[i], px[i + 1], px[i + 2]), Math.min(px[i], px[i + 1], px[i + 2]) / 255) * 255)
  }
  // só os nomes: símbolos (desenhos soltos) e molduras saem
  const alfa = new Uint8ClampedArray(px.length / 4)
  for (let i = 0; i < alfa.length; i++) alfa[i] = out[i * 4 + 3]
  const nomes = soOsNomes(alfa, w, h)
  for (let i = 0; i < alfa.length; i++) out[i * 4 + 3] = nomes[i]
  return out
}

// ---------- só os nomes: as letras ficam, símbolos e molduras saem ----------

// Peças ligadas da imagem (alfa >= corte), com a caixa e a área de cada uma.
function pecasLigadas(alfa, w, h, corte = 128) {
  const rotulo = new Int32Array(w * h).fill(-1)
  const pecas = []
  const pilha = []
  for (let inicio = 0; inicio < w * h; inicio++) {
    if (alfa[inicio] < corte || rotulo[inicio] !== -1) continue
    const id = pecas.length
    const p = { id, x0: w, y0: h, x1: 0, y1: 0, n: 0 }
    rotulo[inicio] = id
    pilha.push(inicio)
    while (pilha.length) {
      const i = pilha.pop()
      const x = i % w, y = (i - x) / w
      p.n++
      if (x < p.x0) p.x0 = x
      if (x > p.x1) p.x1 = x
      if (y < p.y0) p.y0 = y
      if (y > p.y1) p.y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const j = ny * w + nx
          if (alfa[j] >= corte && rotulo[j] === -1) { rotulo[j] = id; pilha.push(j) }
        }
      }
    }
    p.w = p.x1 - p.x0 + 1
    p.h = p.y1 - p.y0 + 1
    p.cy = (p.y0 + p.y1) / 2
    p.densidade = p.n / (p.w * p.h)
    pecas.push(p)
  }
  return { rotulo, pecas }
}

// Quais peças são nomes: letras em linha (3 ou mais, alturas parecidas, lado a lado) ou uma palavra emendada
// (bem mais larga que alta). Molduras (largas e vazadas) e desenhos soltos saem; acentos junto dos nomes ficam.
// Sem nenhum nome reconhecido: null (a logo fica inteira).
function idsDosNomes(pecas, w, h) {
  const minimo = Math.max(6, w * h * 0.0004)
  const moldura = (p) => p.w > 0.6 * w && p.densidade < 0.2
  const candidatas = pecas.filter((p) => p.n >= minimo && !moldura(p)).sort((a, b) => a.x0 - b.x0)
  const linhas = []
  for (const p of candidatas) {
    const linha = linhas.find((l) => {
      const ultima = l[l.length - 1]
      const hm = l.reduce((s, x) => s + x.h, 0) / l.length
      const sobrepoe = Math.min(ultima.x1, p.x1) - Math.max(ultima.x0, p.x0)
      return Math.abs(p.cy - ultima.cy) < 0.35 * hm && p.h / hm > 0.5 && p.h / hm < 2 &&
        p.x0 - ultima.x1 < 1.2 * hm && sobrepoe < 0.3 * Math.min(ultima.w, p.w)
    })
    if (linha) linha.push(p)
    else linhas.push([p])
  }
  const ficam = new Set()
  const caixas = []
  for (const l of linhas) {
    const palavra = l.length === 1 && l[0].w / l[0].h >= 2.5 && l[0].densidade >= 0.15
    if (l.length < 3 && !palavra) continue
    for (const p of l) ficam.add(p.id)
    const hm = l.reduce((s, x) => s + x.h, 0) / l.length
    caixas.push({ x0: Math.min(...l.map((p) => p.x0)), x1: Math.max(...l.map((p) => p.x1)),
      y0: Math.min(...l.map((p) => p.y0)) - 0.6 * hm, y1: Math.max(...l.map((p) => p.y1)) + 0.6 * hm, hm })
  }
  if (!ficam.size) return null
  // acentos, pingos e pedaços pequenos (perto do tamanho de uma letra ou menos) dentro da faixa de um nome
  for (const p of pecas) {
    if (ficam.has(p.id) || moldura(p)) continue
    const cx = (p.x0 + p.x1) / 2
    if (caixas.some((c) => p.h < 0.6 * c.hm && cx >= c.x0 && cx <= c.x1 && p.cy >= c.y0 && p.cy <= c.y1)) ficam.add(p.id)
  }
  return ficam
}

// Alfas (w×h) → alfas só com os nomes. Pixels claros demais para contar (bordas suaves) seguem a peça vizinha.
export function soOsNomes(alfa, w, h) {
  const { rotulo, pecas } = pecasLigadas(alfa, w, h)
  const ficam = idsDosNomes(pecas, w, h)
  if (!ficam) return alfa
  const out = new Uint8ClampedArray(alfa.length)
  for (let i = 0; i < alfa.length; i++) {
    if (!alfa[i]) continue
    let id = rotulo[i]
    if (id === -1) { // borda suave: vale a peça de um vizinho
      const x = i % w, y = (i - x) / w
      for (let dy = -1; dy <= 1 && id === -1; dy++) {
        for (let dx = -1; dx <= 1 && id === -1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) id = rotulo[ny * w + nx]
        }
      }
    }
    if (id !== -1 && ficam.has(id)) out[i] = alfa[i]
  }
  return out
}

// A caixa do que sobrou (alfa visível) em volta: a marca d'água fica do tamanho do nome, encostada no canto.
export function caixaVisivel(px, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] < 16) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

function recortar(tela, px, w, h) {
  const c = caixaVisivel(px, w, h)
  if (!c || (c.w === w && c.h === h)) return tela
  const nova = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(c.w, c.h)
    : Object.assign(document.createElement('canvas'), { width: c.w, height: c.h })
  nova.getContext('2d').drawImage(tela, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h)
  return nova
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
      pronta = recortar(tela, dados.data, w, h)
    }
  } catch (e) {
    console.error(e) // imagem que não deixa ler os pixels: fica a original
  }
  prontas.set(logo, pronta)
  return pronta
}
