// "Enviar meu vídeo" (posts para gravar): escolher o vídeo, editar no aparelho
// ("Editando seu vídeo… N%") e mostrar a prévia com "Baixar vídeo" e "Escolher outro".
// O vídeo editado fica só na memória do aparelho (spec §3.4).
import { t } from '../textos.js'
import { el, aviso, filhosValidos } from '../comum.js'
import { podeEditarVideo, validarDuracao, criarAudioDoGesto, criarVideoDoGesto, codigoDoErro } from '../artes/video.js'
import { gerarVideoEditado } from '../artes/imagens.js'
import { arquivosParaSalvar } from './acoesPost.js'
import { entregar } from './salvarArquivo.js'

const CODIGOS = ['longo', 'invalido', 'sem-permissao', 'falhou', 'interrompido']
const LIMITE_DURACAO = 15000 // ms esperando os metadados

// Mensagem de cada erro.codigo da edição. Aqui o vídeo é editado (não montado): sem suporte tem texto próprio.
export function mensagemDoErroDeVideo(codigo) {
  if (codigo === 'sem-suporte') return t('video.editar.semsuporte')
  return t(`video.erro.${CODIGOS.includes(codigo) ? codigo : 'falhou'}`)
}

// Duração do arquivo em segundos (pelo loadedmetadata). NaN se o navegador não abrir.
function lerDuracao(arquivo) {
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  const url = URL.createObjectURL(arquivo)
  return new Promise((ok) => {
    const limite = setTimeout(() => ok(NaN), LIMITE_DURACAO)
    video.onloadedmetadata = () => { clearTimeout(limite); ok(video.duration) }
    video.onerror = () => { clearTimeout(limite); ok(NaN) }
    video.src = url
  }).finally(() => {
    video.onloadedmetadata = video.onerror = null
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  })
}

const fecharAudio = (audioCtx) => { try { audioCtx?.close()?.catch?.(() => {}) } catch { /* já fechado */ } }

// O som e o <video> nascem juntos, no toque (o iPhone só libera os dois dentro do gesto).
const criarDoGesto = () => ({ audioCtx: criarAudioDoGesto(), video: criarVideoDoGesto() })
const soltarDoGesto = (gesto) => { fecharAudio(gesto?.audioCtx); gesto?.video?.remove() }

// ctx: o do calendário (negocio, produtos, ramo). modo: 'compartilhar' | 'baixar' (modoDoAparelho).
// aoMostrarVideo(sim): a tela do post esconde a capa enquanto a prévia do vídeo editado aparece.
// Devolve { secao, abrir, limpar, parar }: `abrir` vai DIRETO no toque (cria o som e o <video> e abre
// a galeria no gesto); `limpar` quando o texto do post muda; `parar` ao sair da tela.
export function criarEnvioDeVideo({ supabase, post, ctx, modo, aoMostrarVideo }) {
  const secao = el('section', { class: 'video-enviado', hidden: true })
  let editando = false
  let parado = false
  let gestoPendente = null // { audioCtx, video } criados no toque, à espera do arquivo
  let entradaPendente = null // o <input type=file> na página (o Safari antigo não abre um solto)
  let urlDaPrevia = null
  let vez = 0 // limpar() torna velha a edição em andamento (o título do post mudou)

  function limparPrevia() {
    if (urlDaPrevia) URL.revokeObjectURL(urlDaPrevia)
    urlDaPrevia = null
    aoMostrarVideo?.(false)
  }

  // arquivo: o vídeo que falhou. Se o iPhone não deixou tocar ('sem-permissao'), o "Continuar" refaz a
  // edição do mesmo arquivo com som e <video> novos, criados no próprio toque (que vale como gesto).
  function mostrarErro(codigo, arquivo = null) {
    limparPrevia()
    const continuar = codigo === 'sem-permissao' && arquivo
      ? el('button', { type: 'button', texto: t('video.continuar'), onclick: () => continuarEdicao(arquivo) })
      : null
    secao.hidden = false
    secao.replaceChildren(...filhosValidos([ // o nativo escreveria "null"
      el('p', { class: 'erro', role: 'alert', texto: mensagemDoErroDeVideo(codigo) }),
      continuar,
      codigo === 'sem-suporte' ? null : el('button', { type: 'button', class: 'secundario', texto: t('video.escolher'), onclick: abrir })]))
    secao.querySelector('button')?.focus()
  }

  function continuarEdicao(arquivo) {
    if (editando) return aviso(t('post.aguarde'))
    if (parado) return
    editar(arquivo, criarDoGesto()) // síncrono no toque: o play() do <video> acontece aqui dentro
  }

  function mostrarProgresso() {
    limparPrevia()
    const texto = el('p', { id: `editando-${post.id}`, class: 'editando', texto: t('video.editando', { p: 0 }) })
    const barra = el('progress', { max: '100', value: '0', 'aria-labelledby': texto.id })
    secao.hidden = false
    secao.replaceChildren(texto, barra, el('p', { class: 'pequeno muted', texto: t('post.montando.dica') }))
    secao.scrollIntoView?.({ block: 'nearest' })
    return (p) => {
      const pc = Math.round(p * 100)
      barra.value = pc
      texto.textContent = t('video.editando', { p: pc })
    }
  }

  function mostrarPrevia(blob, ext) {
    limparPrevia()
    const arquivos = arquivosParaSalvar(post, [blob], ext) // prontos antes do toque: o iPhone compartilha no gesto
    urlDaPrevia = URL.createObjectURL(blob)
    const video = el('video', { controls: true, playsinline: true, src: urlDaPrevia, 'aria-label': t('video.rotulo') })
    let entregando = false
    const baixar = el('button', {
      type: 'button', texto: t(modo === 'compartilhar' ? 'post.salvar.video' : 'post.baixar.video'),
      onclick: () => {
        if (entregando) return
        entregando = true // sem await antes do compartilhamento
        entregar(arquivos, modo)
          .then((r) => { if (r !== 'cancelado') aviso(t(r === 'compartilhado' ? 'post.salvo' : 'post.baixado.video')) })
          .catch((e) => { console.error(e); aviso(t('erro.geral')) })
          .finally(() => { entregando = false })
      },
    })
    const outro = el('button', { type: 'button', class: 'secundario', texto: t('video.escolher'), onclick: abrir })
    secao.hidden = false
    secao.replaceChildren(video, baixar, outro)
    aoMostrarVideo?.(true)
    aviso(t('video.pronto'))
    baixar.focus()
  }

  async function editar(arquivo, gesto) {
    editando = true
    const minha = vez
    const valendo = () => !parado && minha === vez
    const progredir = mostrarProgresso()
    try {
      const validade = validarDuracao(await lerDuracao(arquivo))
      if (!valendo()) return
      if (validade !== 'ok') return mostrarErro(validade)
      const { blob, ext } = await gerarVideoEditado(supabase, post, ctx, arquivo, (p) => { if (valendo()) progredir(p) }, gesto)
      if (valendo()) mostrarPrevia(blob, ext)
    } catch (e) {
      console.error(e)
      if (valendo()) mostrarErro(codigoDoErro(e), arquivo)
    } finally {
      editando = false
      soltarDoGesto(gesto) // o <video> já saiu da página em editarVideo; aqui cobre um erro antes dele
    }
  }

  // No toque: o AudioContext e o <video> nascem aqui, antes de qualquer await (o Safari só libera
  // o som e o play no gesto). O arquivo entra no <video> depois, em editarVideo.
  function abrir() {
    if (editando) return aviso(t('post.aguarde'))
    if (!podeEditarVideo()) return mostrarErro('sem-suporte')
    esquecerPendentes() // de um toque anterior em que a galeria foi fechada sem escolher
    const gesto = criarDoGesto()
    const entrada = el('input', { type: 'file', accept: 'video/*', hidden: true })
    gestoPendente = gesto
    entradaPendente = entrada
    const soltar = () => {
      entrada.remove()
      if (entradaPendente === entrada) { entradaPendente = null; gestoPendente = null }
    }
    entrada.addEventListener('change', () => {
      const arquivo = entrada.files?.[0]
      soltar()
      if (arquivo && !parado) editar(arquivo, gesto)
      else soltarDoGesto(gesto)
    })
    entrada.addEventListener('cancel', () => { soltar(); soltarDoGesto(gesto) })
    document.body.append(entrada)
    entrada.click()
  }

  // O texto do post mudou (Gerar outro): o vídeo editado tinha o título antigo.
  function limpar() {
    vez++
    limparPrevia()
    secao.replaceChildren()
    secao.hidden = true
  }

  function esquecerPendentes() {
    soltarDoGesto(gestoPendente)
    entradaPendente?.remove()
    gestoPendente = entradaPendente = null
  }

  function parar() {
    parado = true
    esquecerPendentes()
    limparPrevia()
  }

  return { secao, abrir, limpar, parar }
}
