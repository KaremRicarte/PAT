// Calendário do mês: topo, resumo, grade dos dias e a lista do dia escolhido.
import { t } from '../textos.js'
import { el, logo, mostrar, botaoSair, carregando, aviso, filhosValidos } from '../comum.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'
import { mesAlvo, hojeEmSaoPaulo, nomeDoMes } from '../../../supabase/functions/_shared/modelos/calendario.ts'
import { situacaoDoPost, corDoDia, resumoDoMes, diaInicial, gradeDoMes, diaPorExtenso, chaveFormato } from './situacao.js'
import { miniatura } from '../artes/imagens.js'
import { telaQuizMes, rotuloEstrategia, mesMostrado, preferirMes } from './mes.js'
import { aplicarAcao } from './acoesPost.js'
import { telaPost } from './post.js'
import { montarLembretes } from './lembretes.js'

const SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const ORDEM_REDE = { instagram: 0, facebook: 1, tiktok: 2, whatsapp: 3 }
const SITUACOES = ['pendente', 'aprovado', 'reprovado', 'postado'] // ordem no rótulo do dia
const RESUMO = ['postado', 'aprovado', 'pendente', 'reprovado'] // ordem do resumo (spec §3.1)
const ICONE = { postado: '↑', aprovado: '✓', pendente: '…', reprovado: '✕' } // dentro da bolinha: a cor nunca vem sozinha
const CHAVE_DICAS = 'pat.dicas.vistas'
const COLUNAS = 'id, data, rede, tipo, formato, titulo, legenda, hashtags, roteiro, horario, ordem, estado, foto_path, sem_foto, postado_em, produto_id, trocas'

const tituloDoDia = (data) => `${SEMANA[new Date(`${data}T00:00:00Z`).getUTCDay()]}, ${diaPorExtenso(data)}`

// Rótulo do botão do dia para leitores de tela: "4 de novembro, 2 pendentes".
export function rotuloDoDia(data, posts) {
  const dia = diaPorExtenso(data)
  if (!posts.length) return `${dia}, ${t('cal.dia.vazio')}`
  if (corDoDia(posts) === 'postado') return `${dia}, ${t('cal.dia.tudo')}`
  const n = resumoDoMes(posts)
  return [dia, ...SITUACOES.filter((s) => n[s]).map((s) => t(`cal.dia.${s}.${n[s] === 1 ? '1' : 'n'}`, { n: n[s] }))].join(', ')
}

function agruparPorDia(posts) {
  const dias = new Map()
  for (const p of posts) {
    if (!dias.has(p.data)) dias.set(p.data, [])
    dias.get(p.data).push(p)
  }
  for (const lista of dias.values()) lista.sort((a, b) => ORDEM_REDE[a.rede] - ORDEM_REDE[b.rede] || a.ordem - b.ordem)
  return dias
}

function dicasJaVistas() {
  try { return localStorage.getItem(CHAVE_DICAS) === '1' } catch { return false }
}
function marcarDicasVistas() {
  try { localStorage.setItem(CHAVE_DICAS, '1') } catch { /* sem armazenamento: volta na próxima visita */ }
}

let vezDoDesenho = 0 // só a última chamada desenha (troca rápida de mês)

// ctx: { supabase, cliente, negocio, produtos, meses, atualizar }; aqui ganha ramo e os posts do mês mostrado.
// A miniatura de um post, guardada no cache (chave -> promessa do canvas) para não redesenhar.
// A que falhou (null ou erro) sai do cache: a próxima visita ao dia tenta de novo.
export async function guardarMiniatura(cache, chave, gerar) {
  let promessa = cache.get(chave)
  if (!promessa) {
    promessa = Promise.resolve().then(gerar).catch((e) => { console.error(e); return null })
    cache.set(chave, promessa)
  }
  const canvas = await promessa
  if (!canvas && cache.get(chave) === promessa) cache.delete(chave)
  return canvas
}

export async function telaCalendario(ctx, editarNegocio, diaEscolhido) {
  const { supabase, meses } = ctx
  const vez = ++vezDoDesenho
  ctx.ramo = RAMOS[ctx.cliente.ramo]
  const hoje = hojeEmSaoPaulo()
  if (diaEscolhido && meses.some((m) => m.ano_mes === diaEscolhido.slice(0, 7))) preferirMes(diaEscolhido.slice(0, 7))
  const mes = mesMostrado(meses, hoje)

  if (ctx.mesDosPosts !== mes.id) {
    carregando()
    const { data, error } = await supabase.from('posts').select(COLUNAS)
      .eq('mes_id', mes.id).order('data').order('ordem')
    if (vez !== vezDoDesenho) return
    if (error) {
      console.error(error)
      return mostrar(logo(), el('p', { class: 'erro', texto: t('erro.geral') }),
        el('div', { class: 'acoes' }, el('button', { type: 'button', texto: t('comum.tentar'), onclick: ctx.atualizar })))
    }
    ctx.posts = data
    ctx.mesDosPosts = mes.id
    ctx.miniaturas = new Map() // canvas de cada post, para não redesenhar ao voltar a um dia
  }

  const posts = ctx.posts
  const porDia = agruparPorDia(posts)
  const dias = gradeDoMes(mes.ano_mes)
  let escolhido = dias.includes(diaEscolhido) ? diaEscolhido : diaInicial(mes.ano_mes, hoje, posts) // ex.: 2026-11-45 não existe

  // ---------- topo (como na lista antiga) ----------
  const alvo = mesAlvo(hoje, meses.map((m) => m.ano_mes))
  const proximo = alvo
    ? el('button', { type: 'button', texto: t('mes.gerarproximo', { mes: nomeDoMes(alvo.anoMes) }), onclick: () => telaQuizMes(ctx) })
    : null
  const editar = el('button', { type: 'button', class: 'secundario', texto: t('mes.editar'), onclick: () => editarNegocio(ctx) })
  const trocaMes = meses.length > 1
    ? el('div', { class: 'chips' }, meses.slice(0, 3).map((m) => el('button', {
      type: 'button', class: m.id === mes.id ? 'chip ativo' : 'chip', 'aria-pressed': String(m.id === mes.id),
      texto: nomeDoMes(m.ano_mes), onclick: () => { preferirMes(m.ano_mes); telaCalendario(ctx, editarNegocio) },
    })))
    : null

  // ---------- resumo ----------
  const resumo = el('p', { class: 'resumo' })
  const desenharResumo = () => {
    const r = resumoDoMes(posts)
    resumo.replaceChildren(...RESUMO.map((s) => el('span', { class: `item ${s}`, texto: t(`cal.resumo.${s}`, { n: r[s] }) })))
  }

  // ---------- grade ----------
  const botoesDia = new Map()
  const grade = el('div', { class: 'grade', role: 'group', 'aria-label': nomeDoMes(mes.ano_mes) },
    t('cal.semana').split(',').map((letra) => el('span', { class: 'semana', 'aria-hidden': 'true', texto: letra })),
    dias.map((data) => {
      if (!data) return el('span', { class: 'fora', 'aria-hidden': 'true' })
      const b = el('button', { type: 'button', class: data === hoje ? 'dia-btn hoje' : 'dia-btn', onclick: () => escolherDia(data) })
      botoesDia.set(data, b)
      return b
    }))
  const pintarDia = (data, b) => {
    const doDia = porDia.get(data) ?? []
    const cor = corDoDia(doDia)
    b.setAttribute('aria-label', rotuloDoDia(data, doDia))
    b.setAttribute('aria-pressed', String(data === escolhido))
    b.classList.toggle('sem-post', !cor)
    b.replaceChildren(...filhosValidos([el('span', { class: 'num', texto: String(Number(data.slice(8))) }),
      cor ? el('span', { class: `bolinha ${cor}`, 'aria-hidden': 'true', texto: ICONE[cor] }) : null])) // o nativo escreveria "null"
  }
  const pintarGrade = () => botoesDia.forEach((b, data) => pintarDia(data, b))

  // ---------- lista do dia ----------
  const lista = el('section', { class: 'lista-dia' })
  const desenharLista = () => {
    const doDia = porDia.get(escolhido) ?? []
    lista.replaceChildren(...filhosValidos([ // o nativo escreveria "null" e "[object HTMLElement]"
      el('h2', {}, tituloDoDia(escolhido), escolhido === hoje ? el('span', { class: 'selo bom', texto: t('cal.hoje') }) : null),
      doDia.length ? doDia.map(cartaoPost) : el('p', { class: 'muted', texto: t('cal.lista.vazia') })]))
  }

  function escolherDia(data) {
    const antes = escolhido
    escolhido = data
    botoesDia.get(antes)?.setAttribute('aria-pressed', 'false')
    botoesDia.get(data).setAttribute('aria-pressed', 'true')
    desenharLista() // os posts não são recarregados
  }

  // Depois de uma ação: resumo, bolinhas e lista; o foco volta para o cartão do post.
  function redesenhar(post) {
    if (!lista.isConnected) return // o cliente já saiu desta tela
    const tinhaFoco = lista.contains(document.activeElement) || document.activeElement === document.body
    desenharResumo()
    pintarGrade()
    desenharLista()
    if (tinhaFoco) lista.querySelector(`[data-post="${post.id}"]`)?.focus()
  }

  // Voltar da tela do post: o calendário no mesmo dia, com o foco no cartão do post.
  const abrirPost = (post) => telaPost(ctx, post, async () => {
    await telaCalendario(ctx, editarNegocio, post.data)
    const cartao = document.querySelector(`[data-post="${post.id}"]`)
    cartao?.focus({ preventScroll: true })
    cartao?.scrollIntoView({ block: 'center' })
  })

  async function marcarPostado(post) {
    const ok = await aplicarAcao({ supabase, post, acao: 'postei', aoMudar: () => redesenhar(post) })
    if (ok) {
      aviso(t('cal.postei.ok'), {
        desfazer: () => aplicarAcao({ supabase, post, acao: 'despostar', aoMudar: () => redesenhar(post) }),
      })
    }
  }

  function cartaoPost(post) {
    const sit = situacaoDoPost(post)
    const mini = el('span', { class: 'mini', 'aria-hidden': 'true' })
    mini.style.background = ctx.negocio.cor2 // fundo na cor do cliente enquanto a arte é desenhada
    if (post.tipo === 'lista') {
      mini.classList.add('texto')
      mini.append(el('span', { class: 'icone', texto: '💬' }), el('span', { texto: t('cal.sotexto') }))
    } else carregarMiniatura(post, mini)

    const abrir = el('button', { type: 'button', class: 'abrir', 'data-post': post.id, onclick: () => abrirPost(post) },
      mini,
      el('span', { class: 'info' },
        el('span', { class: 'rede', texto: `${t(`rede.${post.rede}`)} · ${t(`formato.${chaveFormato(post)}`)}` }),
        el('strong', { class: 'titulo-post', texto: post.titulo }),
        el('span', { class: 'linha' },
          el('span', { class: 'hora', texto: post.horario }),
          el('span', { class: `situacao ${sit}`, texto: t(`cal.situacao.${sit}`) }))))
    const postei = sit === 'aprovado'
      ? el('button', { type: 'button', class: 'postei', texto: t('cal.postei'), onclick: () => marcarPostado(post) })
      : null
    return el('div', { class: `cartao-post ${sit}` }, abrir, postei)
  }

  async function carregarMiniatura(post, caixa) {
    const chave = `${post.id}|${post.foto_path}|${post.sem_foto}`
    const canvas = await guardarMiniatura(ctx.miniaturas, chave, () => miniatura(supabase, post, ctx))
    if (canvas && caixa.isConnected) caixa.replaceChildren(canvas) // sem arte: fica o fundo na cor do cliente
  }

  // ---------- cartão de dicas (só na primeira visita) ----------
  let dicas = null
  if (!dicasJaVistas()) {
    dicas = el('section', { class: 'dicas' },
      el('h2', { texto: t('cal.dicas.titulo') }),
      el('ol', {}, [1, 2, 3].map((i) => el('li', { texto: t(`cal.dicas.${i}`) }))),
      el('button', {
        type: 'button', texto: t('cal.dicas.ok'),
        onclick: () => { marcarDicasVistas(); dicas.remove(); botoesDia.get(escolhido)?.focus() },
      }))
  }

  // ---------- lembretes: o sino no topo e o aviso entre o resumo e a grade (chegam depois) ----------
  const sino = el('div', { class: 'sino' })
  const avisoLembrete = el('div', { class: 'lembrete-area' })

  ctx.aoMudarPost = redesenhar // um Desfazer tocado depois de voltar da tela do post redesenha o calendário
  desenharResumo()
  pintarGrade()
  desenharLista()
  mostrar(
    el('header', { class: 'topo' }, logo(),
      el('div', { class: 'topo-dir' }, sino, botaoSair(supabase))),
    trocaMes,
    el('h1', { texto: t('mes.titulo', { mes: nomeDoMes(mes.ano_mes) }) }),
    el('p', {}, el('span', { class: 'selo neutro', texto: rotuloEstrategia(mes.estrategia, ctx.ramo) })),
    el('div', { class: 'acoes' }, proximo, editar),
    dicas,
    resumo,
    avisoLembrete,
    grade,
    lista,
  )
  montarLembretes({ supabase, sino, area: avisoLembrete }).catch((e) => console.error(e)) // sem lembretes, o calendário segue igual
}
