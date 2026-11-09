import { t } from '../textos.js'
import { el, logo, campo, mostrar, aoEnviar, botaoSair } from '../comum.js'
import { listarClientes, criarCliente, redefinirSenha, definirSituacao } from './dados.js'

export function telaSoAdmin(supabase) {
  mostrar(logo(),
    el('p', { texto: t('admin.soadmin') }),
    el('div', { class: 'acoes' }, botaoSair(supabase)))
}

// Quadro com a senha provisória: aparece uma vez só.
function quadroSenha(senha) {
  const botao = el('button', { type: 'button', class: 'secundario', texto: t('admin.copiar') })
  botao.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(senha)
      botao.textContent = t('admin.copiado')
    } catch { /* sem permissão de copiar: a senha continua visível */ }
  })
  return el('div', { class: 'quadro-senha', role: 'status' },
    el('p', { class: 'senha' }, t('admin.senhaprov', { senha: '' }), el('strong', { texto: senha })),
    el('p', { class: 'muted', texto: t('admin.envie') }),
    botao)
}

export async function telaPainel(supabase) {
  const aviso = el('div', { class: 'aviso' })
  const lista = el('div', { class: 'lista' })
  const formulario = formNovo(aviso, recarregar)
  formulario.hidden = true

  const botaoNovo = el('button', { type: 'button', texto: t('admin.novo') })
  botaoNovo.addEventListener('click', () => {
    formulario.hidden = !formulario.hidden
    if (!formulario.hidden) formulario.querySelector('input').focus()
  })

  const main = document.getElementById('app')
  main.classList.add('largo')
  mostrar(
    el('header', { class: 'topo' }, logo(), botaoSair(supabase)),
    el('div', { class: 'titulo' }, el('h1', { texto: t('admin.titulo') }), botaoNovo),
    formulario, aviso, lista,
  )

  async function recarregar() {
    let clientes
    try {
      clientes = await listarClientes()
    } catch {
      lista.replaceChildren(el('p', { class: 'erro', texto: t('erro.geral') }))
      return
    }
    if (!clientes.length) return lista.replaceChildren(el('p', { class: 'muted', texto: t('admin.vazio') }))
    lista.replaceChildren(tabela(clientes, aviso, recarregar))
  }
  await recarregar()
}

function formNovo(aviso, recarregar) {
  const idioma = el('select', { id: 'campo-idioma', name: 'idioma' },
    el('option', { value: 'pt', texto: t('admin.idioma.pt') }),
    el('option', { value: 'es', texto: t('admin.idioma.es') }))
  const form = el('form', { class: 'novo', novalidate: true },
    el('h2', { texto: t('admin.novo') }),
    campo(t('admin.nome'), { name: 'nome', autocomplete: 'off', required: true }),
    campo(t('admin.email'), { name: 'email', type: 'email', autocomplete: 'off', required: true }),
    campo(t('admin.telefone'), { name: 'telefone', type: 'tel', autocomplete: 'off', placeholder: '(11) 98765-4321', required: true }),
    el('label', { for: 'campo-idioma', texto: t('admin.idioma') }), idioma,
    el('div', { class: 'acoes' }, el('button', { type: 'submit', texto: t('admin.criar') })),
  )
  aoEnviar(form, async (d) => {
    const r = await criarCliente({
      nome: d.get('nome'), email: d.get('email'), telefone: d.get('telefone'), idioma: d.get('idioma'),
    })
    if (r.erro) return r.erro
    form.reset()
    form.hidden = true
    aviso.replaceChildren(quadroSenha(r.senhaProvisoria))
    await recarregar()
    return null
  })
  return form
}

function tabela(clientes, aviso, recarregar) {
  const cab = [t('admin.nome'), t('admin.email'), t('admin.telefone'), t('admin.idioma'), t('admin.situacao'), '']
  return el('table', { class: 'clientes' },
    el('thead', {}, el('tr', {}, cab.map(c => el('th', { scope: 'col', texto: c })))),
    el('tbody', {}, clientes.map(c => linha(c, aviso, recarregar))))
}

function linha(c, aviso, recarregar) {
  const bloqueado = c.situacao === 'bloqueado'

  const redefinir = el('button', { type: 'button', class: 'secundario pequeno', texto: t('admin.redefinir') })
  redefinir.addEventListener('click', async () => {
    if (!confirm(t('admin.redefinir.confirma', { nome: c.nome }))) return
    redefinir.disabled = true
    const r = await redefinirSenha(c.id)
    redefinir.disabled = false
    if (r.erro) return aviso.replaceChildren(el('p', { class: 'erro', role: 'alert', texto: r.erro }))
    aviso.replaceChildren(quadroSenha(r.senhaProvisoria))
    await recarregar()
  })

  const alternar = el('button', {
    type: 'button', class: 'secundario pequeno',
    texto: bloqueado ? t('admin.reativar') : t('admin.bloquear'),
  })
  alternar.addEventListener('click', async () => {
    const chave = bloqueado ? 'admin.reativar.confirma' : 'admin.bloquear.confirma'
    if (!confirm(t(chave, { nome: c.nome }))) return
    alternar.disabled = true
    const r = await definirSituacao(c.id, bloqueado ? 'ativo' : 'bloqueado')
    alternar.disabled = false
    if (r.erro) return aviso.replaceChildren(el('p', { class: 'erro', role: 'alert', texto: r.erro }))
    aviso.replaceChildren()
    await recarregar()
  })

  const celula = (rotulo, ...filhos) => el('td', { 'data-rotulo': rotulo }, ...filhos)
  return el('tr', {},
    celula(t('admin.nome'), el('strong', { texto: c.nome })),
    celula(t('admin.email'), c.email),
    celula(t('admin.telefone'), c.telefone),
    celula(t('admin.idioma'), c.idioma === 'es' ? t('admin.idioma.es') : t('admin.idioma.pt')),
    celula(t('admin.situacao'),
      el('span', { class: bloqueado ? 'selo ruim' : 'selo bom', texto: bloqueado ? t('admin.bloqueado') : t('admin.ativo') }),
      c.senha_provisoria ? el('span', { class: 'selo neutro', texto: t('admin.provisoria') }) : null),
    el('td', { class: 'acoes-linha' }, redefinir, alternar))
}
