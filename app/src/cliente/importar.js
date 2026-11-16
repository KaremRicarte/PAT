// Funções puras para ler a lista (.txt) e o nome das fotos da importação.
import { precoDoTexto, MAX_ITENS, MAX_FOTOS } from './negocio.js'

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
    if (nome.length < 2 || nome.length > 80) return erro('importar.erro.nome')
    if (preco === 'erro' || promo === 'erro') return erro('importar.erro.preco')
    if (typeof promo === 'number' && preco === null) return erro('importar.erro.semnormal')
    if (typeof promo === 'number' && typeof preco === 'number' && promo > preco) return erro('importar.erro.promomaior')
    linhas.push({ linha, nome, preco, promo })
  })
  return { linhas, erros }
}

function precoParaTexto(v) {
  if (v == null) return ''
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')
}

// Junta o que veio da importação com os itens atuais, sem apagar nada.
export function juntarImportacao(itens, { linhas = [], erros = [], arquivosDeFoto = [] }, { noPromo = false, novoId } = {}) {
  const lista = itens.map((i) => ({
    ...i,
    fotos: [...(i.fotos ?? (i.foto_path ? [{ path: i.foto_path }] : []))],
    promoTexto: i.promoTexto ?? '',
    fotosNovas: 0,
  }))
  const resumo = { novos: 0, atualizados: 0, fotos: 0, semItem: [], foraItens: [], foraFotos: [], erros, precosIgnorados: false }
  const porChave = new Map(lista.map((i) => [normalizarNome(i.nome), i]))
  const foraDaLista = new Set()
  const atualizados = new Set()

  for (const l of linhas) {
    const chave = normalizarNome(l.nome)
    if (noPromo && (l.preco !== undefined || l.promo !== undefined)) resumo.precosIgnorados = true
    let item = porChave.get(chave)
    if (item) {
      if (!atualizados.has(item)) { atualizados.add(item); resumo.atualizados++ }
    } else {
      if (lista.length >= MAX_ITENS) { resumo.foraItens.push(l.nome); foraDaLista.add(chave); continue }
      item = { id: novoId(), nome: l.nome, descricao: '', precoTexto: '', promoTexto: '', fotos: [], novo: true, fotosNovas: 0 }
      lista.push(item)
      porChave.set(chave, item)
      resumo.novos++
    }
    if (!noPromo) {
      if (l.preco !== undefined) item.precoTexto = precoParaTexto(l.preco)
      if (l.promo !== undefined) item.promoTexto = precoParaTexto(l.promo)
    }
  }

  const nomesNoLote = new Map()
  for (const arq of arquivosDeFoto) {
    const chave = chaveDaFoto(arq.name)
    const item = chave ? porChave.get(chave) : null
    if (!item) {
      if (!foraDaLista.has(chave)) resumo.semItem.push(arq.name)
      continue
    }
    const vistos = nomesNoLote.get(item) ?? new Set()
    nomesNoLote.set(item, vistos)
    if (vistos.has(arq.name)) continue
    vistos.add(arq.name)
    if (item.fotos.length >= MAX_FOTOS) { resumo.foraFotos.push(arq.name); continue }
    item.fotos.push({ arquivo: arq, nome: arq.name })
    item.fotosNovas++
    resumo.fotos++
  }

  for (const i of lista) if (!i.fotosNovas) delete i.fotosNovas
  return { itens: lista, resumo }
}
