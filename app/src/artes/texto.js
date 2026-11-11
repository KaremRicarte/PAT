// Cálculos da arte sem canvas: cores, quebra de linha, encaixe do texto e tamanhos.

function rgb(hex) {
  const n = parseInt(String(hex).slice(1), 16)
  return /^#[0-9A-Fa-f]{6}$/.test(String(hex)) ? [n >> 16 & 255, n >> 8 & 255, n & 255] : null
}

// Cor do texto sobre a cor dada (o `ink` do v1).
export function corTexto(hex) {
  const c = rgb(hex)
  if (!c) return '#FFFFFF'
  const L = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
  return L > 0.6 ? '#111111' : '#FFFFFF'
}

// Luminância relativa (WCAG), o `lum` do v1.
export function luminancia(hex) {
  const c = rgb(hex)
  if (!c) return 0
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}

// A cor principal só vai sobre o fundo com contraste de pelo menos 3:1 (o `accOK` do v1).
export function contrasteBom(cor1, cor2) {
  const a = luminancia(cor1), b = luminancia(cor2)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 3
}

// Quebra o texto em linhas de até larguraMax; uma palavra maior que a largura fica sozinha.
export function quebrarLinhas(texto, larguraMax, medir) {
  const linhas = []
  let atual = ''
  for (const palavra of String(texto ?? '').split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra
    if (atual && medir(tentativa) > larguraMax) { linhas.push(atual); atual = palavra } else atual = tentativa
  }
  if (atual) linhas.push(atual)
  return linhas
}

// Acha o maior tamanho de letra (de `tamanho` até `minimo`) em que o texto cabe em alturaMax.
// quebra(texto, tam) -> linhas; altura(nLinhas, tam) -> altura do bloco.
// Se nem no mínimo couber, corta as linhas que sobram e termina a última com "…".
export function encaixarTexto(texto, { tamanho, minimo, alturaMax, quebra, altura }) {
  let tam = tamanho
  for (;;) {
    const linhas = quebra(texto, tam)
    if (altura(linhas.length, tam) <= alturaMax) return { tamanho: tam, linhas }
    const proximo = Math.max(minimo, tam * 0.92)
    if (tam <= minimo || proximo === tam) break
    tam = proximo
  }
  const linhas = quebra(texto, tam)
  let cabem = 1
  while (cabem < linhas.length && altura(cabem + 1, tam) <= alturaMax) cabem++
  if (cabem >= linhas.length) return { tamanho: tam, linhas }
  const palavras = linhas.slice(cabem - 1).join(' ').split(' ')
  let ultima = `${palavras[0]}…`
  for (let n = palavras.length; n > 0; n--) {
    const t = `${palavras.slice(0, n).join(' ').replace(/[\s,.;:!?-]+$/, '')}…`
    if (quebra(t, tam).length === 1) { ultima = t; break }
  }
  return { tamanho: tam, linhas: [...linhas.slice(0, cabem - 1), ultima] }
}

// Tamanho e número de páginas da arte de cada post; null = post sem arte (mensagem de lista).
export function medidaDaArte(post) {
  switch (post.tipo) {
    case 'feed': return { W: 1080, H: 1350, paginas: post.formato === 'carrossel' ? 5 : 1 }
    case 'stories':
    case 'status': return { W: 1080, H: 1920, paginas: 1 }
    case 'video': return { W: 720, H: 1280, paginas: 1 }
    default: return null
  }
}

// Assinatura que vai na arte (o `sig` do v1): o @ sempre com arroba; logo só se carregou;
// sem logo e sem @, entra o nome do negócio.
export function assinaturaDaArte(assinatura, temLogo, nome) {
  const h = String(assinatura?.texto ?? '').trim().replace(/^@+/, '')
  const logo = Boolean(assinatura?.logo && temLogo)
  const texto = h ? `@${h}` : logo ? null : (nome || null)
  return { texto, logo }
}
