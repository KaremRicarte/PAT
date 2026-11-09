// Peças de tela usadas pelo app do cliente e pelo painel.
// Dados do usuário entram sempre como texto (textContent), nunca como HTML.
import { t } from './textos.js'

export function el(tag, atributos = {}, ...filhos) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(atributos)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') n.className = v
    else if (k === 'texto') n.textContent = v
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v)
    else n.setAttribute(k, v === true ? '' : v)
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) n.append(f)
  return n
}

export const logo = () => el('img', { class: 'logo', src: '/img/pat-logo.png', alt: 'PAT' })

let contador = 0
export function campo(rotulo, atributos) {
  const id = `campo-${++contador}`
  return [el('label', { for: id, texto: rotulo }), el('input', { id, ...atributos })]
}

// Mostra uma tela: troca todo o conteúdo do <main id="app">.
export function mostrar(...filhos) {
  const main = document.getElementById('app')
  main.replaceChildren(...filhos)
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
    campo(t('entrar.senha'), { name: 'senha', type: 'password', autocomplete: 'current-password', required: true }),
    el('div', { class: 'acoes' }, el('button', { type: 'submit', texto: t('entrar.botao') })),
  )
  aoEnviar(form, async (d) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: String(d.get('email')).trim().toLowerCase(),
      password: String(d.get('senha')),
    })
    return error ? t('entrar.erro') : null
  })
  mostrar(logo(), form)
}

export const botaoSair = (supabase) =>
  el('button', { type: 'button', class: 'secundario', texto: t('comum.sair'), onclick: () => supabase.auth.signOut() })
