// Tela do post: a arte grande, as ações (aprovar, Postei, reprovar), os textos (copiar) e baixar/salvar.
import { t } from '../textos.js'
import { el, mostrar, aviso, filhosValidos } from '../comum.js'
import { situacaoDoPost, diaPorExtenso, chaveFormato } from './situacao.js'
import { aplicarAcao, gerarOutro, arquivosParaSalvar, trocasDoMes, LIMITE_TROCAS } from './acoesPost.js'
import { entregar, baixarArquivos, modoDoAparelho } from './salvarArquivo.js'
import { textoParaCopiar } from './mes.js'
import { medidaDaArte } from '../artes/texto.js'
import { desenharPaginas, gerarImagens, gerarVideoDeFotos, previaDaMontagem, paraPng } from '../artes/imagens.js'
import { codigoDoErro } from '../artes/video.js'

const movimentoReduzido = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// Páginas do carrossel lado a lado (scroll-snap), com "1/5" e os botões Anterior/Próxima.
function carrossel(telas, titulo) {
  const total = telas.length
  const faixa = el('div', { class: 'carrossel', tabindex: '0', role: 'region', 'aria-label': titulo },
    telas.map((c, i) => el('div', { class: 'pagina', role: 'group', 'aria-label': t('post.pagina.rotulo', { n: i + 1, total }) }, c)))
  const contador = el('span', { class: 'contador' })
  const anterior = el('button', { type: 'button', class: 'secundario', texto: t('post.anterior') })
  const proxima = el('button', { type: 'button', class: 'secundario', texto: t('post.proxima') })
  const atual = () => Math.round(faixa.scrollLeft / (faixa.clientWidth || 1))
  const ir = (i) => faixa.scrollTo({ left: i * faixa.clientWidth, behavior: movimentoReduzido() ? 'auto' : 'smooth' })
  const marcar = () => {
    const i = Math.min(total - 1, Math.max(0, atual()))
    contador.textContent = t('post.pagina', { n: i + 1, total })
    anterior.disabled = i === 0
    proxima.disabled = i === total - 1
  }
  faixa.addEventListener('scroll', marcar, { passive: true })
  anterior.addEventListener('click', () => ir(atual() - 1))
  proxima.addEventListener('click', () => ir(atual() + 1))
  marcar()
  return el('div', { class: 'carrossel-caixa' }, faixa, el('div', { class: 'carrossel-nav' }, anterior, contador, proxima))
}

// ctx: o do calendário ({ supabase, negocio, produtos, ramo, posts, miniaturas, aoMudarPost… }).
// aoVoltar: volta ao calendário, no dia do post.
export function telaPost(ctx, post, aoVoltar) {
  const { supabase } = ctx
  const medida = medidaDaArte(post)
  const ehMontagem = post.tipo === 'video' && post.formato === 'montagem'
  const ehLista = post.tipo === 'lista'
  const modo = modoDoAparelho()
  let pararPrevia = null
  let vezDaArte = 0
  let arquivos = null // os PNGs da arte, preparados logo depois de desenhar (o toque compartilha sem esperar)
  let preparando = false
  let videoPronto = null // a montagem já gravada, à espera do toque em "Salvar vídeo"

  const voltar = el('button', {
    type: 'button', class: 'secundario voltar', texto: t('post.voltar'),
    onclick: () => { pararPrevia?.(); aoVoltar() },
  })
  const cabecalho = el('header', { class: 'cabecalho-post' })
  const arte = el('section', { class: 'arte-grande' })
  const textos = el('section', { class: 'textos-post' })
  const acoes = el('section', { class: 'acoes-post' })
  const extras = el('section', { class: 'acoes-post extras-post' })

  // ---------- cabeçalho: rede, formato, título, quando e situação ----------
  function desenharCabecalho() {
    const sit = situacaoDoPost(post)
    cabecalho.replaceChildren(
      el('p', { class: 'rede', texto: `${t(`rede.${post.rede}`)} · ${t(`formato.${chaveFormato(post)}`)}` }),
      el('h1', { tabindex: '-1', texto: post.titulo }),
      el('p', { class: 'quando' },
        el('span', { texto: t('post.quando', { dia: diaPorExtenso(post.data), hora: post.horario }) }),
        el('span', { class: `situacao ${sit}`, texto: t(`cal.situacao.${sit}`) })))
  }

  // ---------- arte grande ----------
  async function desenharArteGrande() {
    pararPrevia?.()
    pararPrevia = null
    const vez = ++vezDaArte
    arquivos = null
    preparando = Boolean(medida && !ehMontagem)
    atualizarBaixar()
    if (!medida) {
      arte.replaceChildren(el('p', { class: 'muted sem-arte', texto: t('post.semarte') }))
      return
    }
    const espera = el('div', { class: 'espera', texto: t('post.desenhando') })
    espera.style.aspectRatio = `${medida.W} / ${medida.H}`
    espera.style.width = `min(100%, calc(55svh * ${medida.W} / ${medida.H}))` // como a arte: até 55% da tela
    espera.style.background = ctx.negocio.cor2 // na cor do cliente enquanto desenha
    arte.replaceChildren(espera)
    try {
      if (ehMontagem) {
        const previa = await previaDaMontagem(supabase, post, ctx)
        if (vez !== vezDaArte || !arte.isConnected) return previa.parar()
        pararPrevia = previa.parar
        previa.canvas.setAttribute('role', 'img')
        previa.canvas.setAttribute('aria-label', post.titulo)
        arte.replaceChildren(previa.canvas)
        return
      }
      const telas = await desenharPaginas(supabase, post, ctx)
      if (vez !== vezDaArte) return
      if (!arte.isConnected || !telas.length) { preparando = false; return atualizarBaixar() }
      prepararArquivos(telas, vez)
      if (telas.length > 1) return arte.replaceChildren(carrossel(telas, post.titulo))
      telas[0].setAttribute('role', 'img')
      telas[0].setAttribute('aria-label', post.titulo)
      arte.replaceChildren(telas[0])
    } catch (e) {
      console.error(e)
      espera.textContent = '' // fica o fundo na cor do cliente
      if (vez === vezDaArte) { preparando = false; atualizarBaixar() } // o toque gera de novo e baixa
    }
  }

  async function prepararArquivos(telas, vez) {
    try {
      const blobs = await Promise.all(telas.map(paraPng))
      if (vez === vezDaArte) arquivos = arquivosParaSalvar(post, blobs, 'png')
    } catch (e) {
      console.error(e)
    } finally {
      if (vez === vezDaArte) { preparando = false; atualizarBaixar() }
    }
  }

  // ---------- legenda, hashtags e roteiro ----------
  function desenharTextos() {
    textos.replaceChildren(el('div', { class: 'texto-post' },
      el('p', { class: 'legenda', texto: post.legenda }),
      post.hashtags?.length ? el('p', { class: 'muted hashtags', texto: post.hashtags.join(' ') }) : null,
      post.roteiro
        ? el('div', { class: 'roteiro' }, el('h2', { texto: t('mes.roteiro') }),
          el('p', { class: 'legenda', texto: post.roteiro.replace(/^Como montar: /, '') }))
        : null),
    copiar)
  }

  // ---------- botões que guardam estado (ficam os mesmos entre um desenho e outro) ----------
  const copiar = el('button', {
    type: 'button', class: 'secundario', 'data-acao': 'copiar', texto: t(ehLista ? 'post.copiar.lista' : 'post.copiar'),
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(textoParaCopiar(post))
        aviso(t(ehLista ? 'post.copiado.lista' : 'post.copiado'))
      } catch (e) {
        console.error(e)
        aviso(t('post.naocopiou'))
      }
    },
  })

  // No iPhone o botão diz "Salvar" (vai para as Fotos); nos outros, "Baixar".
  const verbo = modo === 'compartilhar' ? 'post.salvar' : 'post.baixar'
  const rotuloBaixar = () => (videoPronto ? t('post.salvar.video')
    : ehMontagem ? t(`${verbo}.video`)
      : medida?.paginas > 1 ? t(`${verbo}.varias`, { n: medida.paginas }) : t(verbo))
  const baixar = medida ? el('button', { type: 'button', class: 'secundario', 'data-acao': 'baixar', texto: rotuloBaixar() }) : null
  const progresso = el('progress', { max: '100', value: '0', hidden: true })
  const sobreBaixar = el('p', { class: 'pequeno', hidden: true })
  let baixando = false

  // No iPhone, enquanto os PNGs não ficam prontos, o botão espera: o compartilhamento não pode esperar depois do toque.
  function atualizarBaixar() {
    if (!baixar || baixando) return
    const esperando = preparando && modo === 'compartilhar'
    baixar.disabled = esperando
    baixar.textContent = esperando ? t('post.baixando') : rotuloBaixar()
  }
  function dizer(texto, classe = 'pequeno muted') {
    sobreBaixar.className = classe
    sobreBaixar.removeAttribute('role')
    sobreBaixar.textContent = texto
    sobreBaixar.hidden = !texto
  }
  function mostrarErro(e) {
    console.error(e)
    dizer(ehMontagem ? t(`video.erro.${codigoDoErro(e)}`) : t('erro.geral'), 'pequeno erro')
    sobreBaixar.setAttribute('role', 'alert')
  }
  function avisarEntrega(resultado, lista) {
    if (resultado === 'cancelado') return
    if (resultado === 'compartilhado') return aviso(t('post.salvo'))
    aviso(ehMontagem ? t('post.baixado.video') : lista.length > 1 ? t('post.baixadas', { n: lista.length }) : t('post.baixado'))
  }
  function ocupar(texto) {
    baixando = true
    baixar.disabled = true
    if (texto) baixar.textContent = texto
  }
  function liberar() {
    baixando = false
    baixar.disabled = false
    atualizarBaixar()
  }

  // Arquivos já prontos: entrega no mesmo toque (sem await antes do compartilhamento).
  function entregarAgora(lista) {
    dizer('')
    baixando = true // um segundo toque com a janela de compartilhar aberta seria recusado
    entregar(lista, modo)
      .then((r) => avisarEntrega(r, lista))
      .catch(mostrarErro)
      .finally(() => { baixando = false })
  }

  // Montagem: gravar demora, então o primeiro toque grava e o "Salvar vídeo" pede um segundo toque.
  async function montarVideo() {
    ocupar(t('post.montando', { p: 0 }))
    dizer(t('post.montando.dica'))
    progresso.value = 0
    progresso.hidden = false
    const vez = vezDaArte // se o texto mudar (Gerar outro) durante a gravação, este vídeo fica velho
    try {
      const { blob, ext } = await gerarVideoDeFotos(supabase, post, ctx, null, (p) => {
        const pc = Math.round(p * 100)
        progresso.value = pc
        baixar.textContent = t('post.montando', { p: pc })
      })
      if (vez === vezDaArte) {
        videoPronto = arquivosParaSalvar(post, [blob], ext)
        dizer(t('post.video.pronto'))
        aviso(t('post.video.pronto'))
      } else dizer('')
    } catch (e) {
      mostrarErro(e)
    } finally {
      progresso.hidden = true
      liberar()
      baixar.focus()
    }
  }

  // A arte não ficou pronta antes do toque (ainda desenhando ou falhou): gera e baixa.
  async function gerarEBaixar() {
    ocupar(t('post.baixando'))
    dizer('')
    try {
      const lista = arquivosParaSalvar(post, await gerarImagens(supabase, post, ctx), 'png')
      await baixarArquivos(lista)
      avisarEntrega('baixado', lista)
    } catch (e) {
      mostrarErro(e)
    } finally {
      liberar()
    }
  }

  baixar?.addEventListener('click', () => {
    if (baixando) return
    if (videoPronto) return entregarAgora(videoPronto)
    if (ehMontagem) return montarVideo()
    if (arquivos) return entregarAgora(arquivos)
    gerarEBaixar()
  })

  // ---------- ações que gravam ----------
  // Na tela, redesenha; se o cliente já voltou ao calendário (Desfazer tocado depois), redesenha o calendário.
  const aoMudar = () => {
    if (acoes.isConnected) { desenharCabecalho(); desenharAcoes() } else ctx.aoMudarPost?.(post)
  }
  async function agir(acao, textoOk, acaoDesfazer) {
    const ok = await aplicarAcao({ supabase, post, acao, aoMudar })
    if (!ok) return
    aviso(t(textoOk), acaoDesfazer ? { desfazer: () => agir(acaoDesfazer, 'post.desfeito') } : undefined)
  }

  // Lugares da Task 8.
  const trocarImagem = () => aviso(t('comum.embreve'))
  const enviarVideo = () => aviso(t('comum.embreve'))

  function desenharAcoes() {
    const naTela = (no) => acoes.contains(no) || extras.contains(no)
    const focoAntes = naTela(document.activeElement) ? document.activeElement.dataset?.acao : null
    const sit = situacaoDoPost(post)
    const botao = (acao, texto, onclick, atributos = {}) =>
      el('button', { type: 'button', 'data-acao': acao, texto, onclick, ...atributos })
    const dica = (texto) => el('p', { class: 'pequeno muted', texto })

    let principais
    if (sit === 'reprovado') {
      principais = [
        el('p', { class: 'estado-post reprovado', texto: `✕ ${t('post.descartado')}` }),
        dica(t('post.descartado.dica')),
        botao('desfazer', t('comum.desfazer'), () => agir('desfazer', 'post.desfeito')),
      ]
    } else if (sit === 'postado') {
      principais = [
        el('p', { class: 'estado-post postado', texto: t('post.postado') }),
        dica(t('post.postado.dica')),
        botao('despostar', t('comum.desfazer'), () => agir('despostar', 'post.desfeito'), { class: 'secundario' }),
      ]
    } else {
      const aprovado = sit === 'aprovado'
      principais = [
        aprovado
          ? botao('aprovar', t('post.aprovado'), () => agir('desaprovar', 'post.desaprovar.ok'), { class: 'aprovado-btn' })
          : botao('aprovar', t('post.aprovar'), () => agir('aprovar', 'post.aprovar.ok')),
        aprovado ? dica(t('post.aprovado.dica')) : null,
        botao('postei', t('post.postei'), () => agir('postei', 'cal.postei.ok', 'despostar'), { class: aprovado ? null : 'secundario' }),
        botao('reprovar', t('post.reprovar'), abrirReprovar, { class: 'secundario perigo' }),
      ]
    }

    const outras = sit === 'reprovado' ? [] : [
      medida ? botao('trocarimagem', t('post.trocarimagem'), trocarImagem, { class: 'secundario' }) : null,
      post.formato === 'gravar' ? botao('enviarvideo', t('post.enviarvideo'), enviarVideo, { class: 'secundario' }) : null,
    ].filter(Boolean)
    const mais = outras.length
      ? el('details', { class: 'mais' }, el('summary', { texto: t('post.mais') }), el('div', { class: 'mais-lista' }, outras))
      : null

    // Logo abaixo da arte, o que decide; os textos vêm depois; baixar e "Mais opções" por último.
    acoes.replaceChildren(...filhosValidos(principais)) // o replaceChildren nativo escreveria "null"
    copiar.hidden = sit === 'reprovado'
    extras.replaceChildren(...filhosValidos([sit === 'reprovado' ? null : [baixar, progresso, sobreBaixar], mais]))
    extras.hidden = !extras.childElementCount
    if (focoAntes) {
      (acoes.querySelector(`[data-acao="${focoAntes}"]`) ?? extras.querySelector(`[data-acao="${focoAntes}"]`)
        ?? acoes.querySelector('button'))?.focus()
    }
  }

  // ---------- Reprovar: Gerar outro ou Só descartar ----------
  function abrirReprovar() {
    const restam = Math.max(0, LIMITE_TROCAS - trocasDoMes(ctx.posts ?? [post]))
    const ids = { titulo: 'reprovar-titulo', gerar: 'reprovar-gerar', descartar: 'reprovar-descartar' }
    const gerar = el('button', { type: 'button', 'aria-describedby': ids.gerar, disabled: restam === 0, texto: t('reprovar.gerar') })
    const descartar = el('button', { type: 'button', class: 'secundario', 'aria-describedby': ids.descartar, texto: t('reprovar.descartar') })
    const cancelar = el('button', { type: 'button', class: 'secundario', texto: t('reprovar.cancelar') })
    const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
    const dialogo = el('dialog', { class: 'dialogo', 'aria-labelledby': ids.titulo },
      el('h2', { id: ids.titulo, texto: t('reprovar.titulo') }),
      el('div', { class: 'opcao' }, gerar, el('p', {
        id: ids.gerar, class: 'pequeno muted',
        texto: restam ? t('reprovar.gerar.dica', { n: restam, total: LIMITE_TROCAS }) : t('reprovar.limite', { total: LIMITE_TROCAS }),
      })),
      el('div', { class: 'opcao' }, descartar, el('p', { id: ids.descartar, class: 'pequeno muted', texto: t('reprovar.descartar.dica') })),
      erro,
      cancelar)
    let ocupado = false
    dialogo.addEventListener('cancel', (ev) => { if (ocupado) ev.preventDefault() }) // Esc não fecha enquanto gera
    dialogo.addEventListener('close', () => dialogo.remove())
    cancelar.addEventListener('click', () => dialogo.close())

    gerar.addEventListener('click', async () => {
      ocupado = true
      gerar.disabled = descartar.disabled = cancelar.disabled = true
      gerar.textContent = t('reprovar.gerando')
      erro.hidden = true
      const r = await gerarOutro({ supabase, post })
      ocupado = false
      cancelar.disabled = descartar.disabled = false
      gerar.textContent = t('reprovar.gerar')
      if (r.post) {
        for (const chave of [...(ctx.miniaturas?.keys() ?? [])]) {
          if (chave.startsWith(`${post.id}|`)) ctx.miniaturas.delete(chave) // o texto mudou: redesenha a miniatura
        }
        Object.assign(post, r.post)
        dialogo.close()
        desenharTudo()
        cabecalho.querySelector('h1').focus() // o leitor de tela lê o título novo
        aviso(t('reprovar.ok'))
        return
      }
      erro.textContent = r.erro
      erro.hidden = false
      // Sem conexão: pode tentar de novo. Limite ou nenhum texto novo: só descartar.
      gerar.disabled = ![t('erro.conexao'), t('erro.geral'), t('post.aguarde')].includes(r.erro)
      ;(gerar.disabled ? descartar : gerar).focus()
    })

    descartar.addEventListener('click', () => {
      dialogo.close()
      agir('descartar', 'post.descartar.ok', 'desfazer')
      acoes.querySelector('button')?.focus() // o Desfazer da tela
    })

    document.body.append(dialogo)
    dialogo.showModal()
    ;(restam ? gerar : descartar).focus()
  }

  function desenharTudo() {
    videoPronto = null // o texto mudou: a montagem gravada é do texto antigo
    dizer('')
    desenharCabecalho()
    desenharTextos()
    desenharAcoes()
    desenharArteGrande()
  }

  desenharCabecalho()
  desenharTextos()
  desenharAcoes()
  mostrar(voltar, cabecalho, arte, acoes, textos, extras) // ver, decidir e, se quiser, ler e baixar
  window.scrollTo(0, 0)
  desenharArteGrande()
}
