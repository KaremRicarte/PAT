// Tela da importação (spec §4): botão, área de arrastar, exemplo, resumo e faixa de fotos do item.
// textoDoResumo é puro (sem DOM) para poder ser testado em node; o resto mexe na página.
import { t } from '../textos.js'
import { el } from '../comum.js'
import { MAX_ITENS, MAX_FOTOS } from './negocio.js'
import { decodificarTexto, lerLista, juntarImportacao } from './importar.js'

const lista = (a) => a.join(', ')

// Linhas do resumo: a primeira diz o que entrou; as outras, com ⚠, o que ficou de fora.
export function textoDoResumo(r, { textosIgnorados = 0 } = {}) {
  const partes = []
  if (r.novos) partes.push(r.novos === 1 ? t('importar.resumo.novo') : t('importar.resumo.novos', { n: r.novos }))
  if (r.atualizados) partes.push(r.atualizados === 1 ? t('importar.resumo.atualizado') : t('importar.resumo.atualizados', { n: r.atualizados }))
  if (r.fotos) partes.push(r.fotos === 1 ? t('importar.resumo.foto') : t('importar.resumo.fotos', { n: r.fotos }))
  const linhas = [partes.length ? t('importar.resumo.importamos', { partes: partes.join(' · ') }) : t('importar.resumo.nada')]
  if (r.semItem?.length) {
    linhas.push(r.semItem.length === 1
      ? t('importar.resumo.semitem1', { lista: lista(r.semItem) })
      : t('importar.resumo.semitemN', { n: r.semItem.length, lista: lista(r.semItem) }))
  }
  if (r.foraItens?.length) linhas.push(t('importar.resumo.foraitens', { max: MAX_ITENS, lista: lista(r.foraItens) }))
  if (r.foraFotos?.length) linhas.push(t('importar.resumo.forafotos', { max: MAX_FOTOS, lista: lista(r.foraFotos) }))
  for (const e of r.erros ?? []) linhas.push(t('importar.resumo.linha', { linha: e.linha, motivo: t(e.chave) }))
  if (r.naoAbriram?.length) {
    linhas.push(r.naoAbriram.length === 1
      ? t('importar.resumo.naoabriu1', { lista: lista(r.naoAbriram) })
      : t('importar.resumo.naoabriuN', { n: r.naoAbriram.length, lista: lista(r.naoAbriram) }))
  }
  if (r.precosIgnorados) linhas.push(t('importar.resumo.precos'))
  if (textosIgnorados) {
    linhas.push(textosIgnorados === 1 ? t('importar.resumo.textos1') : t('importar.resumo.textosN', { n: textosIgnorados }))
  }
  return linhas
}

const ehTexto = (f) => /\.(txt|csv)$/i.test(f.name) || /^text\/(plain|csv)$/.test(f.type)
const ehFoto = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)

// Confere se o navegador consegue abrir a foto (o envio depende disso para reduzi-la).
async function abre(arquivo) {
  try { (await createImageBitmap(arquivo)).close(); return true } catch { return false }
}

// Lê pastas soltas na página (webkitGetAsEntry) e devolve todos os arquivos dentro delas.
async function arquivosDaEntrada(entrada) {
  if (entrada.isFile) return [await new Promise((ok, falha) => entrada.file(ok, falha))]
  const leitor = entrada.createReader()
  const filhos = []
  for (;;) {
    const parte = await new Promise((ok, falha) => leitor.readEntries(ok, falha))
    if (!parte.length) break
    filhos.push(...parte)
  }
  return (await Promise.all(filhos.map(arquivosDaEntrada))).flat()
}

async function arquivosDoDrop(dt) {
  const entradas = [...(dt.items ?? [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean) // antes de qualquer await
  if (entradas.length) return (await Promise.all(entradas.map(arquivosDaEntrada))).flat()
  return [...(dt.files ?? [])]
}

// Selos do item: "Novo" e "+N fotos" (fotos ainda não enviadas). Texto, nunca só cor.
function pintarSelos(destino, item) {
  const novas = item.fotos.filter((f) => f.arquivo).length
  destino.replaceChildren(
    ...(item.novo ? [el('span', { class: 'selo bom', texto: t('quiz.item.novo') })] : []),
    ...(novas ? [el('span', { class: 'selo neutro', texto: novas === 1 ? t('quiz.item.maisfoto') : t('quiz.item.maisfotos', { n: novas }) })] : []))
}

// Faixa de miniaturas do item. `urls` guarda os endereços temporários, para o quiz liberar ao redesenhar.
export function faixaDeFotos({ item, supabase, urls, selos, fotosInfo }) {
  const faixa = el('div', { class: 'faixa-fotos' })
  const erro = el('p', { class: 'erro pequeno', role: 'alert', hidden: true, texto: t('quiz.item.fotos.erro') })
  const entrada = el('input', { type: 'file', multiple: true, accept: 'image/*', hidden: true })
  const adicionar = el('button', { type: 'button', class: 'secundario', texto: t('quiz.item.fotos.add') })
  adicionar.addEventListener('click', () => entrada.click())
  entrada.addEventListener('change', () => {
    const livres = MAX_FOTOS - item.fotos.length
    const escolhidas = [...entrada.files].slice(0, Math.max(livres, 0))
    entrada.value = ''
    Promise.all(escolhidas.map(abre)).then((oks) => {
      escolhidas.forEach((f, i) => { if (oks[i]) item.fotos.push({ arquivo: f, nome: f.name }) })
      erro.hidden = oks.every(Boolean)
      pintar()
    })
  })

  function pintar(focar) {
    const miniaturas = item.fotos.map((foto, i) => {
      const img = el('img', { alt: t('quiz.item.fotos.alt', { n: i + 1, nome: item.nome || '' }), loading: 'lazy' })
      if (foto.arquivo) {
        const u = URL.createObjectURL(foto.arquivo)
        urls.push(u)
        img.src = u
      } else {
        supabase.storage.from('marcas').createSignedUrl(foto.path, 3600)
          .then(({ data }) => { if (data?.signedUrl) img.src = data.signedUrl })
          .catch((e) => console.error(e))
      }
      const x = el('button', { type: 'button', class: 'remover-foto', 'aria-label': t('quiz.item.fotos.remover', { n: i + 1 }), texto: '✕' })
      x.addEventListener('click', () => { item.fotos.splice(i, 1); pintar(true) })
      const info = foto.path ? fotosInfo?.get(foto.path) : null
      const ruim = info?.serve === false
        ? el('p', { class: 'aviso-foto', texto: t('quiz.item.fotos.ruim', { motivo: info.motivo || t('quiz.item.fotos.motivo') }) })
        : null
      return el('div', { class: ruim ? 'miniatura com-aviso' : 'miniatura' }, img, x, ruim)
    })
    adicionar.hidden = item.fotos.length >= MAX_FOTOS
    faixa.replaceChildren(...miniaturas, adicionar, entrada)
    pintarSelos(selos, item)
    if (focar) (adicionar.hidden ? faixa.querySelector('.remover-foto') : adicionar)?.focus()
  }
  pintar()
  return el('div', {}, faixa, erro)
}

// Botão "Importar lista e fotos", ajuda, exemplo, área de arrastar e resumo.
// Ao importar, troca estado.itens e chama aoMudar() para o quiz redesenhar a lista.
export function montarImportacao({ ramo, estado, aoMudar }) {
  const entrada = el('input', { type: 'file', multiple: true, accept: '.txt,.csv,image/*', hidden: true })
  const botao = el('button', { type: 'button', class: 'secundario', texto: t('importar.botao') })
  botao.addEventListener('click', () => entrada.click())
  const resumo = el('div', { class: 'resumo-importacao', role: 'status' })
  const zona = el('div', { class: 'zona-soltar', hidden: true, texto: t('importar.arrastar') })

  async function importar(arquivos) {
    const textos = arquivos.filter(ehTexto)
    const candidatas = arquivos.filter((f) => !ehTexto(f) && ehFoto(f))
    if (!textos.length && !candidatas.length) return
    resumo.replaceChildren(el('p', { texto: t('importar.lendo') }))
    try {
      const oks = await Promise.all(candidatas.map(abre))
      const fotos = candidatas.filter((_, i) => oks[i])
      const naoAbriram = candidatas.filter((_, i) => !oks[i]).map((f) => f.name)
      const lido = textos.length ? lerLista(decodificarTexto(await textos[0].arrayBuffer())) : { linhas: [], erros: [] }
      const r = juntarImportacao(estado.itens, { ...lido, arquivosDeFoto: fotos },
        { noPromo: !!ramo.noPromo, novoId: () => crypto.randomUUID() })
      estado.itens = r.itens
      const linhas = textoDoResumo({ ...r.resumo, naoAbriram }, { textosIgnorados: Math.max(textos.length - 1, 0) })
      resumo.replaceChildren(el('p', { class: 'resumo-titulo', texto: linhas[0] }), ...linhas.slice(1).map((l) => el('p', { texto: l })))
      aoMudar()
    } catch (e) {
      console.error(e)
      resumo.replaceChildren(el('p', { class: 'erro', texto: t('importar.erro.leitura') }))
    }
  }

  entrada.addEventListener('change', () => { const a = [...entrada.files]; entrada.value = ''; importar(a) })

  // Arrastar: a área só aparece quando arquivos entram na página. Os ouvintes saem sozinhos quando a tela some.
  const temArquivos = (ev) => [...(ev.dataTransfer?.types ?? [])].includes('Files')
  const ouvintes = {
    dragenter: (ev) => { if (temArquivos(ev)) zona.hidden = false },
    dragover: (ev) => { if (temArquivos(ev)) ev.preventDefault() },
    dragleave: (ev) => { if (!ev.relatedTarget) zona.hidden = true },
    drop: async (ev) => {
      if (!temArquivos(ev)) return
      ev.preventDefault()
      zona.hidden = true
      importar(await arquivosDoDrop(ev.dataTransfer))
    },
  }
  for (const [nome, fn] of Object.entries(ouvintes)) {
    const f = (ev) => {
      if (!zona.isConnected) { document.removeEventListener(nome, f); return }
      fn(ev)
    }
    document.addEventListener(nome, f)
  }

  const como = el('details', { class: 'como-montar' },
    el('summary', { texto: t('importar.como') }),
    el('p', { texto: t('importar.como.formato') }),
    el('pre', { texto: t('importar.como.exemplo') }),
    el('p', { texto: t('importar.como.fotos') }))

  return [botao, entrada, el('p', { class: 'muted pequeno', texto: t('importar.ajuda') }), como, zona, resumo]
}
