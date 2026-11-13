// Lembretes por notificação (web push): estado, ativar, desligar, o aviso e o sino do calendário.
import { t } from '../textos.js'
import { el, aviso } from '../comum.js'
import { ehIphone } from '../aparelho.js'

export { ehIphone }

const CHAVE_ADIADO = 'pat-lembrete-adiado'
const DIAS_ADIADO = 7

// A primeira regra que valer: sem a chave VAPID no app não há como inscrever (nem adianta instalar);
// no iPhone fora da tela inicial o Safari nem oferece push, por isso "instalar" vem antes do resto.
export function estadoDosLembretes({ temPush, temChave, permissao, iphone, instalado, inscrito }) {
  if (!temChave) return 'sem-suporte'
  if (iphone && !instalado) return 'instalar'
  if (!temPush) return 'sem-suporte'
  if (permissao === 'denied') return 'bloqueado'
  if (permissao === 'granted' && inscrito) return 'ativo'
  return 'inativo'
}

// Chave pública VAPID (base64url, sem "=") para os bytes que o pushManager.subscribe pede.
export function chaveParaBytes(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

// ---------- "Agora não": o aviso some por 7 dias (guardado no aparelho) ----------
export function adiarAviso(agora = new Date()) {
  try { localStorage.setItem(CHAVE_ADIADO, agora.toISOString()) } catch { /* sem armazenamento: o aviso volta na próxima visita */ }
}

export function avisoAdiado(agora = new Date()) {
  let guardado = null
  try { guardado = localStorage.getItem(CHAVE_ADIADO) } catch { return false }
  const desde = guardado ? new Date(guardado).getTime() : NaN
  return Number.isFinite(desde) && agora.getTime() - desde < DIAS_ADIADO * 24 * 60 * 60 * 1000
}

// ---------- aparelho ----------
const temPush = () => 'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis
const permissaoAtual = () => ('Notification' in globalThis ? Notification.permission : 'default')
const chaveVapid = () => import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''
const instalado = () => globalThis.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

async function inscricaoDoAparelho() {
  const registro = await navigator.serviceWorker.getRegistration()
  return (await registro?.pushManager.getSubscription()) ?? null
}

// Inscrito = o aparelho tem inscrição E ela é deste cliente no banco (o aparelho pode ter sido de outra conta).
async function estaInscrito(supabase) {
  const inscricao = await inscricaoDoAparelho()
  if (!inscricao) return false
  const { data, error } = await supabase.from('push_inscricoes').select('id').eq('endpoint', inscricao.endpoint).maybeSingle()
  if (error) { console.error(error); return true } // sem conexão: vale o que o aparelho diz
  return Boolean(data)
}

export async function lerEstado(supabase) {
  const push = temPush()
  const permissao = permissaoAtual()
  return estadoDosLembretes({
    temPush: push,
    temChave: Boolean(chaveVapid()),
    permissao,
    iphone: ehIphone(navigator.userAgent, navigator.maxTouchPoints),
    instalado: instalado(),
    inscrito: push && permissao === 'granted' ? await estaInscrito(supabase) : false,
  })
}

// Estado depois de um pedido de permissão que não deu 'granted'.
const semPermissao = (permissao) => (permissao === 'denied' ? 'bloqueado' : 'inativo')

// Inscreve o aparelho e pede a notificação de teste. Devolve o novo estado: 'ativo', 'bloqueado'
// ou 'inativo' (o cliente fechou o pedido). A inscrição passa pela RPC inscrever_push: o mesmo
// endpoint de outra conta passa a ser de quem ativou.
// registro: a registration do service worker já pronta (buscada quando a tela montou). Com ela,
// o subscribe é a PRIMEIRA chamada do toque (o iPhone só pede a permissão dentro do gesto) e ele
// mesmo pede a permissão. Sem ela, o caminho de reserva: permissão, registro, depois o subscribe.
export async function ativarLembretes(supabase, registro = null) {
  const chave = chaveVapid()
  if (!chave) throw new Error('VITE_VAPID_PUBLIC_KEY ausente') // a tela nem mostra o botão (sem-suporte)
  const opcoes = { userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }
  let inscricao
  if (registro) {
    try {
      inscricao = await registro.pushManager.subscribe(opcoes) // a mesma chave devolve a inscrição que já existe
    } catch (e) {
      if (permissaoAtual() !== 'granted') return semPermissao(permissaoAtual())
      throw e
    }
  } else {
    const permissao = await Notification.requestPermission()
    if (permissao !== 'granted') return semPermissao(permissao)
    await navigator.serviceWorker.register('/sw.js')
    const pronto = await navigator.serviceWorker.ready
    inscricao = (await pronto.pushManager.getSubscription()) ?? await pronto.pushManager.subscribe(opcoes)
  }

  const { endpoint, keys } = inscricao.toJSON()
  const { error } = await supabase.rpc('inscrever_push', { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth })
  if (error) throw error

  const teste = await supabase.functions.invoke('lembrete-teste', { body: {} })
  if (teste.error) console.error(teste.error) // os lembretes já estão ativos; só a notificação de teste falhou
  return 'ativo'
}

// Cancela a inscrição do aparelho e apaga a linha do banco. Se o apagar falhar, a função lembrete
// apaga a linha sozinha quando o envio responder 404/410.
export async function desligarLembretes(supabase) {
  const inscricao = await inscricaoDoAparelho()
  if (!inscricao) return 'inativo'
  const { endpoint } = inscricao
  await inscricao.unsubscribe()
  const { error } = await supabase.from('push_inscricoes').delete().eq('endpoint', endpoint)
  if (error) console.error(error)
  return 'inativo'
}

// ---------- janelas ----------
function abrirJanela(titulo, ...conteudo) {
  const id = 'lembrete-titulo'
  const janela = el('dialog', { class: 'dialogo lembrete', 'aria-labelledby': id },
    el('h2', { id, texto: titulo }),
    ...conteudo,
    el('button', { type: 'button', texto: t('lembrete.entendi'), onclick: () => janela.close() }))
  janela.addEventListener('close', () => janela.remove())
  document.body.append(janela)
  janela.showModal()
}

const ICONES_IPHONE = ['⬆️', '➕', '📲'] // Compartilhar, Adicionar, abrir pelo ícone

const abrirPassoAPasso = () => abrirJanela(t('lembrete.iphone.titulo'),
  el('p', { texto: t('lembrete.iphone.dica') }),
  el('ol', { class: 'passos-iphone' }, [1, 2, 3].map((i) => el('li', {},
    el('span', { class: 'icone', 'aria-hidden': 'true', texto: ICONES_IPHONE[i - 1] }),
    el('span', { texto: t(`lembrete.iphone.${i}`) })))))

const abrirBloqueado = () => abrirJanela(t('lembrete.bloqueado.titulo'), el('p', { texto: t('lembrete.bloqueado') }))

// ---------- no calendário ----------
// sino: a caixa no topo; area: onde fica o aviso "Quer um lembrete…". As duas ficam vazias até o estado chegar.
export async function montarLembretes({ supabase, sino, area }) {
  let estado
  try { estado = await lerEstado(supabase) } catch (e) { console.error(e); return }
  if (estado === 'sem-suporte' || !sino.isConnected) return

  // A registration fica guardada desde já: no toque em Ativar, o subscribe não pode esperar nada antes.
  let registro = null
  // `?.`: no navegador de dentro do Instagram/Facebook no iPhone não há serviceWorker, e o aviso "instalar" tem de aparecer mesmo assim.
  navigator.serviceWorker?.ready.then((r) => { registro = r }).catch((e) => console.error(e))

  const textoSino = el('span')
  const iconeSino = el('span', { 'aria-hidden': 'true' })
  const botaoSino = el('button', { type: 'button', class: 'secundario botao-sino', onclick: () => (estado === 'ativo' ? desligar() : ativar()) },
    iconeSino, textoSino)
  const botaoAtivar = el('button', { type: 'button', texto: t('lembrete.ativar'), onclick: () => ativar() })
  const cartao = el('section', { class: 'lembrete-aviso', 'aria-label': t('lembrete.aviso') },
    el('p', { texto: t('lembrete.aviso') }),
    el('div', { class: 'acoes-linha' },
      el('button', { type: 'button', class: 'secundario', texto: t('lembrete.agoranao'), onclick: () => { adiarAviso(); desenhar(); aviso(t('lembrete.adiado')) } }),
      botaoAtivar))

  // focoNoCartao: o foco estava no cartão antes de um botão dele ser desativado (e o foco escapar).
  function desenhar(focoNoCartao = false) {
    const ligado = estado === 'ativo'
    iconeSino.textContent = ligado ? '🔔' : '🔕'
    textoSino.textContent = t(ligado ? 'lembrete.sino.ligado' : 'lembrete.sino.desligado')
    const comAviso = (estado === 'inativo' || estado === 'instalar') && !avisoAdiado()
    if (!comAviso && (focoNoCartao || cartao.contains(document.activeElement))) botaoSino.focus() // o foco não se perde com o cartão
    area.replaceChildren(...(comAviso ? [cartao] : []))
  }

  const ocupado = (sim) => { botaoSino.disabled = sim; botaoAtivar.disabled = sim }

  async function ativar() {
    if (estado === 'instalar') return abrirPassoAPasso()
    if (estado === 'bloqueado') return abrirBloqueado()
    const focoNoCartao = cartao.contains(document.activeElement)
    ocupado(true)
    try {
      estado = await ativarLembretes(supabase, registro)
      if (estado === 'ativo') aviso(t('lembrete.ativados'))
    } catch (e) {
      console.error(e)
      aviso(t('lembrete.erro'))
    } finally {
      ocupado(false)
      desenhar(focoNoCartao)
    }
    if (estado === 'bloqueado') abrirBloqueado() // depois de desenhar: ao fechar, o foco volta ao sino
  }

  async function desligar() {
    ocupado(true)
    try {
      estado = await desligarLembretes(supabase)
      adiarAviso() // quem acabou de desligar não precisa do convite logo em seguida
      aviso(t('lembrete.desligados'))
    } catch (e) {
      console.error(e)
      aviso(t('erro.conexao'))
    } finally {
      ocupado(false)
      desenhar()
    }
  }

  sino.replaceChildren(botaoSino)
  desenhar()
}
