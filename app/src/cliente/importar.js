// Funções puras para ler a lista (.txt) e o nome das fotos da importação.
import { precoDoTexto } from './negocio.js'

export function normalizarNome(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function chaveDaFoto(nomeArquivo) {
  const nome = String(nomeArquivo ?? '')
  const i = nome.indexOf('_')
  if (i >= 0) return normalizarNome(nome.slice(0, i))
  return normalizarNome(nome.replace(/\.[^.]*$/, ''))
}

export function decodificarTexto(bytes) {
  let txt
  try {
    txt = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    txt = new TextDecoder('windows-1252').decode(bytes)
  }
  return txt.replace(/^\uFEFF/, '')
}

// undefined = em branco; null = zero explícito; 'erro' = inválido.
function lerPreco(s) {
  const t = String(s ?? '').replace(/R\$|\s/g, '')
  if (!t) return undefined
  if (/^0+([.,]0+)?$/.test(t)) return null
  const v = precoDoTexto(t)
  return v === null ? 'erro' : v
}

export function lerLista(texto) {
  const linhas = []
  const erros = []
  String(texto ?? '').split(/\r?\n/).forEach((bruta, idx) => {
    const linha = idx + 1
    const t = bruta.trim()
    if (!t || t.startsWith('#')) return
    const partes = (t.includes(';') ? t.split(';') : t.split(',')).map((p) => p.trim())
    const nome = partes[0]
    const preco = lerPreco(partes[1])
    const promo = lerPreco(partes[2])
    const erro = (chave) => erros.push({ linha, chave })
    if ((nome.match(/\p{L}/gu) || []).length < 1) return erro('importar.erro.nome')
    if (preco === 'erro' || promo === 'erro') return erro('importar.erro.preco')
    if (typeof promo === 'number' && preco === null) return erro('importar.erro.semnormal')
    if (typeof promo === 'number' && typeof preco === 'number' && promo > preco) return erro('importar.erro.promomaior')
    linhas.push({ linha, nome, preco, promo })
  })
  return { linhas, erros }
}
