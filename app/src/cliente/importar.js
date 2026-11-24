// Funções puras para ler a lista (.txt) e o nome das fotos da importação.
import { precoDoTexto, MAX_ITENS, MAX_FOTOS, normalizarNome } from './negocio.js'

export { normalizarNome } from './negocio.js'

// Chaves possíveis do item de uma foto, da mais específica para a menos: o nome inteiro (sem extensão),
// depois sem a numeração do fim (_01, -2, " (3)", " 4") e cortando pedaços do fim no "_".
// Ex.: october_fest_01.jpg -> octoberfest01, octoberfest, october; gramado_praca.jpg -> gramadopraca, gramado.
function nomeDaFoto(nomeArquivo) {
  const semExt = String(nomeArquivo ?? '').replace(/\.[^.]*$/, '')
  const semNumero = semExt.replace(/[\s_-]*\(?\d+\)?$/, '') || semExt
  return { semExt, partes: semNumero.split('_') }
}

export function chavesDaFoto(nomeArquivo) {
  const { semExt, partes } = nomeDaFoto(nomeArquivo)
  const chaves = [semExt]
  for (let n = partes.length; n >= 1; n--) chaves.push(partes.slice(0, n).join(''))
  return [...new Set(chaves.map(normalizarNome).filter(Boolean))]
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

// Resumo do conteúdo do arquivo original (SHA-256, 32 primeiros caracteres em hex): a mesma foto dá o mesmo
// resumo, mesmo com outro nome. Vira o nome do arquivo guardado, para reconhecer a foto numa nova importação.
export async function resumoDoArquivo(arquivo) {
  const bytes = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer())
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

// Junta o que veio da importação com os itens atuais, sem apagar nada.
// hashes (opcional): Map arquivo -> resumoDoArquivo, para não importar duas vezes a mesma foto.
export function juntarImportacao(itens, { linhas = [], erros = [], arquivosDeFoto = [], hashes } = {}, { noPromo = false, novoId } = {}) {
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
  const doArquivo = new Set() // itens citados no arquivo, na ordem do arquivo

  for (const l of linhas) {
    const chave = normalizarNome(l.nome)
    if (noPromo && (l.preco !== undefined || l.promo !== undefined)) resumo.precosIgnorados = true
    let item = porChave.get(chave)
    if (item) doArquivo.add(item)
    if (item) {
      if (!atualizados.has(item)) { atualizados.add(item); resumo.atualizados++ }
    } else {
      if (lista.length >= MAX_ITENS) { resumo.foraItens.push(l.nome); foraDaLista.add(chave); continue }
      item = { id: novoId(), nome: l.nome, descricao: '', precoTexto: '', promoTexto: '', fotos: [], novo: true, fotosNovas: 0 }
      lista.push(item)
      porChave.set(chave, item)
      doArquivo.add(item)
      resumo.novos++
    }
    if (!noPromo) {
      if (l.preco !== undefined) item.precoTexto = precoParaTexto(l.preco)
      if (l.promo !== undefined) item.promoTexto = precoParaTexto(l.promo)
    }
  }

  const nomesNoLote = new Map()
  for (const arq of arquivosDeFoto) {
    const chaves = chavesDaFoto(arq.name)
    const achada = chaves.find((c) => porChave.has(c))
    const item = achada ? porChave.get(achada) : null
    if (!item) {
      if (!chaves.some((c) => foraDaLista.has(c))) resumo.semItem.push(arq.name)
      continue
    }
    const vistos = nomesNoLote.get(item) ?? new Set()
    nomesNoLote.set(item, vistos)
    if (vistos.has(arq.name)) continue
    vistos.add(arq.name)
    // a mesma foto (mesmo conteúdo) já está no item, salva ou neste lote: fica de fora em silêncio
    const hash = hashes?.get(arq)
    if (hash && item.fotos.some((f) => f.hash === hash || f.path?.endsWith(`/${hash}.jpg`))) continue
    if (item.fotos.length >= MAX_FOTOS) { resumo.foraFotos.push(arq.name); continue }
    item.fotos.push(hash ? { arquivo: arq, nome: arq.name, hash } : { arquivo: arq, nome: arq.name })
    item.fotosNovas++
    resumo.fotos++
  }

  for (const i of lista) if (!i.fotosNovas) delete i.fotosNovas
  // Os itens do arquivo vêm primeiro (e viram posts primeiro); os cadastrados à mão ficam depois.
  return { itens: [...doArquivo, ...lista.filter((i) => !doArquivo.has(i))], resumo }
}
