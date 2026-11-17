// Peças de tela usadas pelo app do cliente e pelo painel.
// Dados do usuário entram sempre como texto (textContent), nunca como HTML.
import { t } from './textos.js'
import { erroTrocaSenha, erroEsqueci } from './senha.js'
import { linkExpirado } from './linkDoEmail.js'

// Achata listas de filhos e descarta os vazios (null, undefined, false).
export const filhosValidos = (filhos) => filhos.flat(Infinity).filter((f) => f !== null && f !== undefined && f !== false)

export function el(tag, atributos = {}, ...filhos) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(atributos)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') n.className = v
    else if (k === 'texto') n.textContent = v
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v)
    else n.setAttribute(k, v === true ? '' : v)
  }
  n.append(...filhosValidos(filhos))
  return n
}

export const logo = () => el('img', { class: 'logo', src: '/img/pat-logo.png', alt: 'PAT' })

let contador = 0
export function campo(rotulo, atributos) {
  const id = `campo-${++contador}`
  return [el('label', { for: id, texto: rotulo }), el('input', { id, ...atributos })]
}

// Ícone do olho (aberto ou riscado), desenhado com DOM: nada de innerHTML.
const SVG = 'http://www.w3.org/2000/svg'
function iconeOlho(riscado) {
  const svg = document.createElementNS(SVG, 'svg')
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v)
  const tracos = ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z']
  if (riscado) tracos.push('M3 3l18 18')
  for (const d of tracos) { const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); svg.append(p) }
  return svg
}

// Campo de senha com o botão do olho, que mostra ou esconde o que foi digitado.
function campoSenha(rotulo, atributos) {
  const [label, input] = campo(rotulo, { ...atributos, type: 'password' })
  const botao = el('button', { type: 'button', class: 'olho', 'aria-label': t('senha.mostrar'), 'aria-pressed': 'false', 'aria-controls': input.id })
  botao.append(iconeOlho(false))
  botao.addEventListener('click', () => {
    const mostrando = input.type === 'password'
    input.type = mostrando ? 'text' : 'password'
    botao.setAttribute('aria-label', t(mostrando ? 'senha.esconder' : 'senha.mostrar'))
    botao.setAttribute('aria-pressed', String(mostrando))
    botao.replaceChildren(iconeOlho(mostrando))
  })
  return [label, el('div', { class: 'campo-senha' }, input, botao)]
}

// Formulário "Nova senha" + "Repita a senha". aoSalvar roda depois que a senha foi trocada
// e devolve a mensagem de erro (ou null). extras = botões ao lado do Salvar.
export function formSenha(supabase, { titulo, texto, aoSalvar, extras = [] }) {
  const form = el('form', { novalidate: true },
    el('h1', { texto: titulo }),
    texto ? el('p', { class: 'muted', texto }) : null,
    campoSenha(t('senha.nova'), { name: 'senha', autocomplete: 'new-password', minlength: 8, required: true }),
    campoSenha(t('senha.repetir'), { name: 'repetir', autocomplete: 'new-password', required: true }),
    el('div', { class: 'acoes' }, el('button', { type: 'submit', texto: t('senha.botao') }), extras),
  )
  let senhaJaTrocada = false // se só o passo seguinte falhar, a nova tentativa refaz só ele
  aoEnviar(form, async (d) => {
    const senha = String(d.get('senha'))
    if (senha.length < 8) return t('senha.curta')
    if (senha !== String(d.get('repetir'))) return t('senha.diferente')
    if (!senhaJaTrocada) {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) return t(erroTrocaSenha(error))
      senhaJaTrocada = true
    }
    return aoSalvar()
  })
  return form
}

// Mostra uma tela: troca todo o conteúdo do <main id="app">.
export function mostrar(...filhos) {
  const main = document.getElementById('app')
  main.replaceChildren(...filhosValidos(filhos))
  main.querySelector('input, button')?.focus({ preventScroll: true })
}

export const carregando = () => mostrar(logo(), el('p', { class: 'muted', texto: t('comum.carregando') }))

// Liga um formulário a uma ação assíncrona: desativa o botão enquanto roda
// e mostra a mensagem de erro que a ação devolver.
export function aoEnviar(form, acao) {
  const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
  form.querySelector('.acoes').before(erro)
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const botao = form.querySelector('button[type=submit]')
    botao.disabled = true
    erro.hidden = true
    try {
      const msg = await acao(new FormData(form))
      if (msg) { erro.textContent = msg; erro.hidden = false }
    } catch (e) {
      console.error(e)
      erro.textContent = t('erro.geral')
      erro.hidden = false
    } finally {
      botao.disabled = false
    }
  })
  return form
}

export function telaEntrar(supabase) {
  const form = el('form', { novalidate: true },
    el('h1', { texto: t('entrar.titulo') }),
    campo(t('entrar.email'), { name: 'email', type: 'email', autocomplete: 'email', required: true }),
    campoSenha(t('entrar.senha'), { name: 'senha', autocomplete: 'current-password', required: true }),
    el('div', { class: 'acoes' }, el('button', { type: 'submit', texto: t('entrar.botao') })),
  )
  const esqueci = el('button', { type: 'button', class: 'link', texto: t('esqueci.link'),
    onclick: () => telaEsqueci(supabase, String(new FormData(form).get('email') ?? '').trim()) })
  aoEnviar(form, async (d) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: String(d.get('email')).trim().toLowerCase(),
      password: String(d.get('senha')),
    })
    return error ? t('entrar.erro') : null
  })
  const vencido = linkExpirado && !avisouLinkVencido
    ? el('p', { class: 'erro', role: 'alert', texto: t('esqueci.vencido') }) : null
  avisouLinkVencido = true
  mostrar(logo(), vencido, form, esqueci)
}
let avisouLinkVencido = false // o aviso do link vencido aparece uma vez só

// "Esqueci minha senha": pede ao Supabase o e-mail com o link, que volta para esta mesma página
// (app ou painel). A resposta é a mesma para e-mail cadastrado ou não.
function telaEsqueci(supabase, emailDigitado = '') {
  const form = el('form', { novalidate: true },
    el('h1', { texto: t('esqueci.titulo') }),
    el('p', { class: 'muted', texto: t('esqueci.texto') }),
    campo(t('entrar.email'), { name: 'email', type: 'email', autocomplete: 'email', required: true, value: emailDigitado || undefined }),
    el('div', { class: 'acoes' },
      el('button', { type: 'submit', texto: t('esqueci.botao') }),
      el('button', { type: 'button', class: 'secundario', texto: t('comum.voltar'), onclick: () => telaEntrar(supabase) })),
  )
  aoEnviar(form, async (d) => {
    const email = String(d.get('email')).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('esqueci.email')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
    if (error) return t(erroEsqueci(error))
    mostrar(logo(),
      el('h1', { texto: t('esqueci.enviado.titulo') }),
      el('p', { texto: t('esqueci.enviado.texto', { email }) }),
      el('p', { class: 'muted', texto: t('esqueci.enviado.spam') }),
      el('div', { class: 'acoes' }, el('button', { type: 'button', texto: t('esqueci.voltar'), onclick: () => telaEntrar(supabase) })))
    return null
  })
  mostrar(logo(), form)
}

export const botaoSair = (supabase) =>
  el('button', { type: 'button', class: 'secundario', texto: t('comum.sair'), onclick: () => supabase.auth.signOut() })

// Aviso curto fixo no rodapé ("Aprovado ✓"). Some em 3 s, ou em 6 s quando tem Desfazer.
// A região role=status fica sempre na página (nunca hidden): vazia, só some da vista (CSS :empty),
// e os leitores de tela anunciam quando o conteúdo muda.
let prazoDoAviso
export function prepararAviso() {
  let caixa = document.getElementById('aviso-rodape')
  if (!caixa) {
    caixa = el('div', { id: 'aviso-rodape', class: 'aviso-rodape', role: 'status' })
    document.body.append(caixa) // fora do <main>: continua visível quando a tela muda
  }
  return caixa
}

export function aviso(texto, { desfazer } = {}) {
  const nova = !document.getElementById('aviso-rodape')
  const caixa = prepararAviso()
  const fechar = () => { clearTimeout(prazoDoAviso); caixa.replaceChildren() }
  const encher = () => {
    caixa.replaceChildren(...filhosValidos([el('span', { texto }), desfazer // o nativo escreveria "null"
      ? el('button', { type: 'button', class: 'pequeno', texto: t('comum.desfazer'), onclick: () => { fechar(); desfazer() } })
      : null]))
    prazoDoAviso = setTimeout(fechar, desfazer ? 6000 : 3000)
  }
  clearTimeout(prazoDoAviso)
  if (nova) prazoDoAviso = setTimeout(encher, 100) // região recém-criada: dá tempo de entrar na árvore de acessibilidade
  else encher()
}
