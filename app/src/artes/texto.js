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
function luminancia(hex) {
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
// Com largura(linha, tam) e larguraMax, uma linha mais larga (palavra comprida) também não cabe.
// Se nem no mínimo couber, corta as linhas que sobram e termina a última com "…".
export function encaixarTexto(texto, { tamanho, minimo, alturaMax, quebra, altura, largura, larguraMax = Infinity }) {
  const larga = (linhas, tam) => Boolean(largura) && linhas.some((l) => largura(l, tam) > larguraMax)
  let tam = tamanho
  for (;;) {
    const linhas = quebra(texto, tam)
    if (altura(linhas.length, tam) <= alturaMax && !larga(linhas, tam)) return { tamanho: tam, linhas }
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
    // carrossel: o texto em páginas (o com preço segue a composição antiga, de 5 páginas)
    case 'feed': return { W: 1080, H: 1350, paginas: post.formato !== 'carrossel' ? 1 : post.preco_por != null ? 5 : paginasDoCarrossel(post.legenda) }
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

// ---------- carrossel: o texto da legenda dividido em páginas ----------

// páginas de texto do meio: cada parágrafo tem a sua (capa + gancho + 8 + convite + fecho = 12 páginas no máximo;
// o Instagram aceita até 20). Só um texto muito longo junta parágrafos curtos na mesma página.
const MAX_MEIOS = 8
const LONGO = 260 // parágrafo maior que isto vira duas páginas (pelas frases)
const ASSINATURA = /^Siga @|^Siga |· Instagram @/

function dividirLongo(p) {
  if (p.length <= LONGO) return [p]
  const frases = p.includes('\n') ? p.split(/\n+/) : p.split(/(?<=[.!?…])\s+/)
  const partes = []
  for (const fr of frases) {
    const ultima = partes.at(-1)
    if (ultima && ultima.length + fr.length + 1 <= LONGO * 0.8) partes[partes.length - 1] = `${ultima}${p.includes('\n') ? '\n' : ' '}${fr}`
    else partes.push(fr)
  }
  return partes
}

// Gancho (2ª página), os blocos do meio (uma página cada, no máximo MAX_MEIOS) e o convite (penúltima).
// A assinatura no fim da legenda ("Siga @...", "Nome · Instagram @...") não vira página.
export function blocosDoCarrossel(legenda) {
  const par = String(legenda ?? '').split(/\n\s*\n+/).map((x) => x.trim()).filter(Boolean)
  while (par.length > 1 && ASSINATURA.test(par.at(-1))) par.pop()
  if (!par.length) return { gancho: '', meios: [], convite: '' }
  const convite = par.length >= 2 ? par.at(-1) : ''
  let meios = par.slice(1, par.length >= 2 ? -1 : 1).flatMap(dividirLongo)
  // sobrou página: junta o par vizinho mais curto (o texto não se perde, só divide a página)
  while (meios.length > MAX_MEIOS) {
    let i = 0
    for (let j = 1; j < meios.length - 1; j++) if (meios[j].length + meios[j + 1].length < meios[i].length + meios[i + 1].length) i = j
    meios = [...meios.slice(0, i), `${meios[i]}\n${meios[i + 1]}`, ...meios.slice(i + 2)]
  }
  return { gancho: par[0], meios, convite }
}

// Páginas do carrossel: capa, gancho, uma por bloco do meio, convite (se houver) e o fecho.
export function paginasDoCarrossel(legenda) {
  const b = blocosDoCarrossel(legenda)
  return 2 + b.meios.length + (b.convite ? 1 : 0) + 1
}
