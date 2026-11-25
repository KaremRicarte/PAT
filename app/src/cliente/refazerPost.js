// "Refazer este post": a tela sugere uma foto nova (ou pede para enviar uma, se o item só tem uma), o cliente corrige
// os dados do item, se quiser, e escolhe refazer só este post ou todos os posts do dia (função refazer-posts com
// { post_id, foto_path?, dia? }). Os posts refeitos ganham foto e texto novos; a IA não repete o título anterior.
import { t } from '../textos.js'
import { el, logo, mostrar, campo, aviso } from '../comum.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'
import { validarItens, itensParaSalvar, reduzirFoto, FOTO_MAX, MAX_FOTOS } from './negocio.js'
import { resumoDoArquivo } from './importar.js'
import { fotoDoPost, fotosDoProduto } from './situacao.js'
import { abrirTrocaDeFoto, desenharMini, caminhoDaFotoDoPost } from './trocarFoto.js'
import { diaMes } from '../../../supabase/functions/_shared/modelos/datas.ts'
import { estadoDoNegocio, camposDePrecoDoItem } from './perguntas.js'
import { chamarFuncao } from './refazer.js'
import { datasParaPromocao } from '../../../supabase/functions/_shared/modelos/datas.ts'
import { hojeEmSaoPaulo } from '../../../supabase/functions/_shared/modelos/calendario.ts'

// O que gravar no item, a partir do formulário (mesmas regras do cadastro de itens).
export function itemParaGravar(item, ramo) {
  const [salvo] = itensParaSalvar([item], ramo)
  return { nome: salvo.nome.trim(), descricao: salvo.descricao?.trim() || null, preco: salvo.preco,
    preco_promo: salvo.preco_promo, promo_data: salvo.promo_data, ocultar_preco: salvo.ocultar_preco, pacote: salvo.pacote }
}

// Foto sugerida: a próxima foto do item depois da atual (em ciclo); null se não há outra.
export function fotoSugerida(fotosDoItem, atual) {
  const i = fotosDoItem.indexOf(atual)
  if (i < 0) return fotosDoItem.find((f) => f !== atual) ?? null
  const proxima = fotosDoItem[(i + 1) % fotosDoItem.length]
  return proxima === atual ? null : proxima
}

// Os posts do mesmo dia que ainda não foram postados (inclui o próprio post).
export const postsDoDia = (posts, post) => posts.filter((p) => p.data === post.data && !p.postado_em)

// O que vai para a função: a foto só quando foi escolhida (sem ela, a atual fica); o dia só quando pedido.
export function corpoDoRefazer({ postId, foto, dia }) {
  return { post_id: postId, ...(typeof foto === 'string' ? { foto_path: foto } : {}), ...(dia ? { dia: true } : {}) }
}

// Foto nova enviada no "Refazer": entra no item (nome = resumo do conteúdo, como na importação) e vira a foto do post.
// Com o item cheio (12 fotos), fica só como foto deste post.
async function enviarFotoNova(supabase, uid, produto, post, arquivo) {
  const blob = await reduzirFoto(arquivo, FOTO_MAX, 'image/jpeg')
  const cabe = (produto.fotos ?? []).length < MAX_FOTOS
  const path = cabe ? `${uid}/produtos/${produto.id}/${await resumoDoArquivo(arquivo)}.jpg` : caminhoDaFotoDoPost(uid, post.id)
  const { error } = await supabase.storage.from('marcas').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
  if (cabe && !(produto.fotos ?? []).includes(path)) {
    const fotos = [...(produto.fotos ?? []), path]
    const r = await supabase.from('produtos').update({ fotos, foto_path: fotos[0] }).eq('id', produto.id)
    if (r.error) throw r.error
    produto.fotos = fotos
  }
  return path
}

// Pergunta "O que refazer?": resolve 'este', 'dia' ou null (cancelou).
function perguntarQual(post, n) {
  return new Promise((resolver) => {
    const dialogo = el('dialog', { class: 'dialogo', 'aria-labelledby': 'refazer-qual-titulo' })
    const fechar = (r) => { dialogo.close(); dialogo.remove(); resolver(r) }
    const este = el('button', { type: 'button', texto: t('refazer1.qual.este'), onclick: () => fechar('este') })
    dialogo.append(el('h2', { id: 'refazer-qual-titulo', texto: t('refazer1.qual.titulo') }),
      el('div', { class: 'acoes coluna' }, este,
        el('button', { type: 'button', class: 'secundario', texto: t('refazer1.qual.dia', { dia: diaMes(post.data), n }), onclick: () => fechar('dia') }),
        el('button', { type: 'button', class: 'secundario', texto: t('estrat.cancelar'), onclick: () => fechar(null) })))
    dialogo.addEventListener('cancel', (ev) => { ev.preventDefault(); fechar(null) })
    document.body.append(dialogo)
    dialogo.showModal()
    este.focus()
  })
}

// aoCancelar: volta ao post; aoRefeito: o post foi refeito (o calendário recarrega e mostra o PAT trabalhando).
export function telaRefazerPost(ctx, post, { aoCancelar, aoRefeito }) {
  const { supabase } = ctx
  const ramo = ctx.ramo ?? RAMOS[ctx.cliente.ramo]
  const produto = post.produto_id ? (ctx.produtos ?? []).find((p) => p.id === post.produto_id) : null
  const item = produto ? estadoDoNegocio(null, [produto], ramo).itens[0] : null

  const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
  const refazer = el('button', { type: 'submit', texto: t('refazer1.botao') })
  const cancelar = el('button', { type: 'button', class: 'secundario', texto: t('estrat.cancelar'), onclick: aoCancelar })

  // ---------- foto: sugerida (item com 2+ fotos) ou "Enviar nova foto" (0 ou 1) ----------
  const uid = ctx.cliente.id
  const atual = fotoDoPost(post, ctx.produtos ?? [], ramo, ctx.fotosInfo)
  const comFoto = Boolean(produto) && !ramo.textOnly
  const fotosDoItem = comFoto ? fotosDoProduto(produto, ctx.fotosInfo) : []
  let foto = comFoto ? fotoSugerida(fotosDoItem, atual) : null // string = trocar por esta; null = manter a atual
  let arquivoNovo = null // foto enviada agora (sobe ao tocar em Refazer)
  let urlNova = null
  const blocoFoto = el('section', { class: 'refazer-foto' })
  function desenharFoto() {
    if (!comFoto) return blocoFoto.replaceChildren()
    const mini = el('div', { class: 'mini-foto' })
    const enviar = el('input', { type: 'file', accept: 'image/*', hidden: true })
    enviar.addEventListener('change', () => {
      const a = enviar.files?.[0]
      if (a) { arquivoNovo = a; foto = null; desenharFoto() }
    })
    const botaoEnviar = el('button', { type: 'button', class: 'secundario pequeno', texto: t('refazer1.foto.enviar'), onclick: () => enviar.click() })
    if (arquivoNovo) {
      if (urlNova) URL.revokeObjectURL(urlNova)
      urlNova = URL.createObjectURL(arquivoNovo)
      mini.append(el('img', { alt: '', src: urlNova }))
      return blocoFoto.replaceChildren(el('h2', { texto: t('refazer1.foto.titulo') }),
        el('div', { class: 'foto-e-botoes' }, mini, el('div', { class: 'botoes' }, botaoEnviar, enviar)))
    }
    if (fotosDoItem.length < 2) {
      const cabe = (produto.fotos ?? []).length < MAX_FOTOS
      return blocoFoto.replaceChildren(
        el('p', { class: 'aviso-foto', texto: t(fotosDoItem.length ? 'refazer1.foto.uma' : 'refazer1.foto.nenhuma') }),
        cabe ? el('div', {}, botaoEnviar, enviar) : null)
    }
    const outra = el('button', { type: 'button', class: 'secundario pequeno', texto: t('refazer1.foto.outra'), onclick: () => abrirTrocaDeFoto({
      supabase, post: { ...post, foto_path: foto ?? atual }, produtos: [produto], ramo, fotosInfo: ctx.fotosInfo,
      aoEscolher: (escolha) => {
        if (escolha.foto_path) { foto = escolha.foto_path; arquivoNovo = null }
        else if (escolha.arquivo) { arquivoNovo = escolha.arquivo; foto = null }
        desenharFoto()
      },
    }) })
    const manter = el('button', { type: 'button', class: 'secundario pequeno', texto: t('refazer1.foto.manter'), onclick: () => { foto = null; desenharFoto() } })
    const mostrada = foto ?? atual
    if (mostrada) desenharMini(supabase, mostrada, mini)
    blocoFoto.replaceChildren(el('h2', { texto: t('refazer1.foto.titulo') }),
      el('div', { class: 'foto-e-botoes' }, mini, el('div', { class: 'botoes' }, outra, foto ? manter : null, enviar)),
      foto ? null : el('p', { class: 'muted pequeno', texto: t('refazer1.foto.mantida') }))
  }
  desenharFoto()

  let campos = []
  if (item) {
    const [rNome, iNome] = campo(t('quiz.item.nome'), { value: item.nome, maxlength: 80 })
    iNome.addEventListener('input', () => { item.nome = iNome.value })
    const [rDesc, iDesc] = campo(t('quiz.item.descricao'), { value: item.descricao, maxlength: 300 })
    iDesc.addEventListener('input', () => { item.descricao = iDesc.value })
    campos = [rNome, iNome, rDesc, iDesc]
    campos.push(...camposDePrecoDoItem(item, ramo, ramo.noPromo ? [] : datasParaPromocao(hojeEmSaoPaulo(), ramo)))
  }

  const form = el('form', { novalidate: true, class: 'quiz' },
    el('h1', { texto: t('refazer1.titulo') }),
    el('p', { class: 'muted', texto: item ? t('refazer1.dica.item', { nome: produto.nome }) : t('refazer1.dica.geral') }),
    blocoFoto,
    ...campos,
    item ? el('p', { class: 'muted pequeno', texto: t('refazer1.outros') }) : null,
    erro,
    el('div', { class: 'acoes' }, refazer, cancelar))

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    erro.hidden = true
    if (item) {
      const problema = validarItens([item], ramo)
      if (problema) { erro.textContent = t(problema, { max: 20 }); erro.hidden = false; return }
    }
    // só este post ou todos os do dia (a pergunta só aparece se o dia tem mais de um post para refazer)
    const doDia = postsDoDia(ctx.posts ?? [], post)
    const qual = doDia.length > 1 ? await perguntarQual(post, doDia.length) : 'este'
    if (!qual) return
    refazer.disabled = cancelar.disabled = true
    refazer.textContent = t('refazer1.fazendo')
    let fotoFinal = foto
    try {
      if (arquivoNovo) fotoFinal = await enviarFotoNova(supabase, uid, produto, post, arquivoNovo)
      if (item) {
        const dados = itemParaGravar(item, ramo)
        const { error } = await supabase.from('produtos').update(dados).eq('id', produto.id)
        if (error) throw error
        Object.assign(produto, dados) // a lista de itens em memória fica igual à do banco
      }
    } catch (e) {
      console.error(e)
      erro.textContent = t('erro.geral'); erro.hidden = false
      refazer.disabled = cancelar.disabled = false; refazer.textContent = t('refazer1.botao')
      return
    }
    const r = await chamarFuncao(supabase, 'refazer-posts', corpoDoRefazer({ postId: post.id, foto: fotoFinal, dia: qual === 'dia' }))
    if (r.erro) {
      erro.textContent = r.erro; erro.hidden = false
      refazer.disabled = cancelar.disabled = false; refazer.textContent = t('refazer1.botao')
      return
    }
    aviso(t('refazer1.ok'))
    aoRefeito()
  })
  mostrar(logo(), form)
}
