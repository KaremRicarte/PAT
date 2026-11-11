// Tela do post: a arte grande, os textos e as ações (aprovar, Postei, copiar, baixar, reprovar).
import { t } from '../textos.js'
import { el, mostrar, aviso } from '../comum.js'
import { situacaoDoPost, diaPorExtenso, chaveFormato } from './situacao.js'
import { aplicarAcao, gerarOutro, nomeDoArquivo, trocasDoMes, LIMITE_TROCAS } from './acoesPost.js'
import { textoParaCopiar } from './mes.js'
import { medidaDaArte } from '../artes/texto.js'
import { desenharPaginas, gerarImagens, gerarVideoDeFotos, previaDaMontagem } from '../artes/imagens.js'
import { codigoDoErro } from '../artes/video.js'

const movimentoReduzido = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms))

// Entrega o arquivo ao aparelho por um <a download>.
function salvar(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = el('a', { href: url, download: nome, hidden: true })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

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
  let pararPrevia = null
  let vezDaArte = 0

  const voltar = el('button', {
    type: 'button', class: 'secundario voltar', texto: t('post.voltar'),
    onclick: () => { pararPrevia?.(); aoVoltar() },
  })
  const cabecalho = el('header', { class: 'cabecalho-post' })
  const arte = el('section', { class: 'arte-grande' })
  const textos = el('section', { class: 'texto-post' })
  const acoes = el('section', { class: 'acoes-post' })

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
    if (!medida) {
      arte.replaceChildren(el('p', { class: 'muted sem-arte', texto: t('post.semarte') }))
      return
    }
    const espera = el('div', { class: 'espera', texto: t('post.desenhando') })
    espera.style.aspectRatio = `${medida.W} / ${medida.H}`
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
      if (vez !== vezDaArte || !arte.isConnected || !telas.length) return
      if (telas.length > 1) return arte.replaceChildren(carrossel(telas, post.titulo))
      telas[0].setAttribute('role', 'img')
      telas[0].setAttribute('aria-label', post.titulo)
      arte.replaceChildren(telas[0])
    } catch (e) {
      console.error(e)
      espera.textContent = '' // fica o fundo na cor do cliente
    }
  }

  // ---------- legenda, hashtags e roteiro ----------
  function desenharTextos() {
    textos.replaceChildren(
      el('p', { class: 'legenda', texto: post.legenda }),
      post.hashtags?.length ? el('p', { class: 'muted hashtags', texto: post.hashtags.join(' ') }) : null,
      post.roteiro
        ? el('div', { class: 'roteiro' }, el('h2', { texto: t('mes.roteiro') }),
          el('p', { class: 'legenda', texto: post.roteiro.replace(/^Como montar: /, '') }))
        : null)
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

  const rotuloBaixar = () => (ehMontagem ? t('post.baixar.video')
    : medida?.paginas > 1 ? t('post.baixar.varias', { n: medida.paginas }) : t('post.baixar'))
  const baixar = medida ? el('button', { type: 'button', class: 'secundario', 'data-acao': 'baixar', texto: rotuloBaixar() }) : null
  const progresso = el('progress', { max: '100', value: '0', hidden: true })
  const sobreBaixar = el('p', { class: 'pequeno', hidden: true })
  let baixando = false
  baixar?.addEventListener('click', async () => {
    if (baixando) return
    baixando = true
    baixar.disabled = true
    sobreBaixar.hidden = true
    sobreBaixar.removeAttribute('role')
    try {
      if (ehMontagem) {
        sobreBaixar.className = 'pequeno muted'
        sobreBaixar.textContent = t('post.montando.dica')
        sobreBaixar.hidden = false
        progresso.value = 0
        progresso.hidden = false
        baixar.textContent = t('post.montando', { p: 0 })
        const { blob, ext } = await gerarVideoDeFotos(supabase, post, ctx, null, (p) => {
          const pc = Math.round(p * 100)
          progresso.value = pc
          baixar.textContent = t('post.montando', { p: pc })
        })
        salvar(blob, nomeDoArquivo(post, null, ext))
        aviso(t('post.baixado.video'))
      } else {
        baixar.textContent = t('post.baixando')
        const blobs = await gerarImagens(supabase, post, ctx)
        for (let i = 0; i < blobs.length; i++) {
          if (i) await pausa(400) // um arquivo de cada vez: alguns navegadores barram vários juntos
          salvar(blobs[i], nomeDoArquivo(post, blobs.length > 1 ? i + 1 : null, 'png'))
        }
        aviso(blobs.length > 1 ? t('post.baixadas', { n: blobs.length }) : t('post.baixado'))
      }
      sobreBaixar.hidden = true
    } catch (e) {
      console.error(e)
      sobreBaixar.className = 'pequeno erro'
      sobreBaixar.setAttribute('role', 'alert')
      sobreBaixar.textContent = ehMontagem ? t(`video.erro.${codigoDoErro(e)}`) : t('erro.geral')
      sobreBaixar.hidden = false
    } finally {
      baixando = false
      baixar.disabled = false
      baixar.textContent = rotuloBaixar()
      progresso.hidden = true
    }
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
    const focoAntes = acoes.contains(document.activeElement) ? document.activeElement.dataset?.acao : null
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
      ]
    }

    const mais = sit === 'reprovado' ? null : el('details', { class: 'mais' },
      el('summary', { texto: t('post.mais') }),
      el('div', { class: 'mais-lista' },
        medida ? botao('trocarimagem', t('post.trocarimagem'), trocarImagem, { class: 'secundario' }) : null,
        post.formato === 'gravar' ? botao('enviarvideo', t('post.enviarvideo'), enviarVideo, { class: 'secundario' }) : null,
        sit === 'postado' ? null : botao('reprovar', t('post.reprovar'), abrirReprovar, { class: 'secundario perigo' })))

    acoes.replaceChildren(
      ...principais,
      sit === 'reprovado' ? null : [copiar, baixar, progresso, sobreBaixar],
      mais)
    if (focoAntes) (acoes.querySelector(`[data-acao="${focoAntes}"]`) ?? acoes.querySelector('button'))?.focus()
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
    desenharCabecalho()
    desenharTextos()
    desenharAcoes()
    desenharArteGrande()
  }

  desenharCabecalho()
  desenharTextos()
  desenharAcoes()
  mostrar(voltar, cabecalho, arte, textos, acoes) // ver, ler e decidir
  window.scrollTo(0, 0)
  desenharArteGrande()
}
