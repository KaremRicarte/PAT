import { t } from '../textos.js'
import { el, logo, campo, mostrar, aoEnviar, botaoSair } from '../comum.js'
import { listarClientes, criarCliente, redefinirSenha, definirSituacao, definirRamo, definirRedes, definirFrequencia, salvarNegocioDoAdmin } from './dados.js'
import { validarNegocio } from './negocio.js'
import { reduzirFoto, LOGO_MAX } from '../cliente/negocio.js'
import { FREQUENCIAS } from '../../../supabase/functions/_shared/modelos/tipos.ts'
import { listaRamos } from './ramo.js'
import { areaBanco } from './banco.js'

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
    formulario, aviso, lista, areaBanco(),
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

// <select> de ramo; a lista vem do registro de ramos.
function seletorRamo(atributos, atual = '') {
  return el('select', atributos,
    el('option', { value: '', texto: t('admin.ramo.escolha') }),
    listaRamos().map(r => el('option', { value: r.id, texto: r.nome, selected: r.id === atual })))
}

// Campos do negócio (nome, Instagram, logo). ler() devolve { erro } ou { dados, logoBlob }.
function camposDoNegocio(atual = null) {
  const [rNome, iNome] = campo(t('admin.negocio.nome'), { name: 'negocio_nome', autocomplete: 'off', maxlength: 80, value: atual?.nome ?? '' })
  const [rInsta, iInsta] = campo(t('admin.negocio.insta'), { name: 'negocio_insta', autocomplete: 'off', maxlength: 31, placeholder: '@seunegocio', value: atual?.insta ?? '' })
  const [rLogo, iLogo] = campo(atual?.logo_path ? t('admin.negocio.logo.troca') : t('admin.negocio.logo'),
    { name: 'negocio_logo', type: 'file', accept: 'image/png,image/jpeg,image/webp' })
  return {
    elementos: [rNome, iNome, rInsta, iInsta, rLogo, iLogo],
    async ler() {
      const v = validarNegocio({ nome: iNome.value, insta: iInsta.value })
      if (v.erro) return { erro: t(v.erro) }
      const arquivo = iLogo.files?.[0]
      let logoBlob = null
      if (arquivo) {
        try { logoBlob = await reduzirFoto(arquivo, LOGO_MAX, 'image/png') } catch { return { erro: t('quiz.foto.erro') } }
      }
      return { dados: v.dados, logoBlob }
    },
  }
}

// Janela "Alterar negócio" de um cliente da lista.
function janelaNegocio(c, recarregar) {
  const campos = camposDoNegocio(c.negocio)
  const cancelar = el('button', { type: 'button', class: 'secundario', texto: t('admin.negocio.cancelar') })
  const form = el('form', { method: 'dialog', novalidate: true },
    el('h2', { texto: t('admin.negocio.titulo', { nome: c.nome }) }),
    ...campos.elementos,
    el('div', { class: 'acoes' }, el('button', { type: 'submit', texto: t('admin.negocio.salvar') }), cancelar))
  const janela = el('dialog', { class: 'dialogo' }, form)
  cancelar.addEventListener('click', () => janela.close())
  janela.addEventListener('close', () => janela.remove())
  aoEnviar(form, async () => {
    const lido = await campos.ler()
    if (lido.erro) return lido.erro
    const r = await salvarNegocioDoAdmin(c, lido.dados, lido.logoBlob)
    if (r.erro) return r.erro
    janela.close()
    await recarregar()
    return null
  })
  document.body.append(janela)
  janela.showModal()
}

function formNovo(aviso, recarregar) {
  const ramo = seletorRamo({ id: 'campo-ramo', name: 'ramo', required: true })
  const idioma = el('select', { id: 'campo-idioma', name: 'idioma' },
    el('option', { value: 'pt', texto: t('admin.idioma.pt') }),
    el('option', { value: 'es', texto: t('admin.idioma.es') }))
  const negocio = camposDoNegocio()
  const form = el('form', { class: 'novo', novalidate: true },
    el('h2', { texto: t('admin.novo') }),
    campo(t('admin.nome'), { name: 'nome', autocomplete: 'off', required: true }),
    campo(t('admin.email'), { name: 'email', type: 'email', autocomplete: 'off', required: true }),
    campo(t('admin.telefone'), { name: 'telefone', type: 'tel', autocomplete: 'off', placeholder: '(11) 98765-4321', required: true }),
    el('label', { for: 'campo-ramo', texto: t('admin.ramo') }), ramo,
    el('label', { for: 'campo-idioma', texto: t('admin.idioma') }), idioma,
    ...negocio.elementos,
    el('div', { class: 'acoes' }, el('button', { type: 'submit', texto: t('admin.criar') })),
  )
  aoEnviar(form, async (d) => {
    const lido = await negocio.ler() // confere o negócio antes de criar o cliente
    if (lido.erro) return lido.erro
    const r = await criarCliente({
      nome: d.get('nome'), email: d.get('email'), telefone: d.get('telefone'), idioma: d.get('idioma'), ramo: d.get('ramo'),
    })
    if (r.erro) return r.erro
    const n = await salvarNegocioDoAdmin({ id: r.id, ramo: d.get('ramo'), negocio: null }, lido.dados, lido.logoBlob)
    form.reset()
    form.hidden = true
    aviso.replaceChildren(quadroSenha(r.senhaProvisoria),
      n.erro ? el('p', { class: 'erro', role: 'alert', texto: t('admin.negocio.erro') }) : null)
    await recarregar()
    return null
  })
  return form
}

function tabela(clientes, aviso, recarregar) {
  const cab = [t('admin.nome'), t('admin.negocio'), t('admin.email'), t('admin.telefone'), t('admin.ramo'), t('admin.redes'), t('admin.frequencia'), t('admin.idioma'), t('admin.situacao'), '']
  return el('table', { class: 'clientes' },
    el('thead', {}, el('tr', {}, cab.map(c => el('th', { scope: 'col', texto: c })))),
    el('tbody', {}, clientes.map(c => linha(c, aviso, recarregar))))
}

const REDES = ['instagram', 'facebook', 'tiktok', 'whatsapp']

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

  const ramo = seletorRamo({ class: 'pequeno', 'aria-label': t('admin.ramo') + ': ' + c.nome }, c.ramo ?? '')
  ramo.addEventListener('change', async () => {
    if (!ramo.value || !confirm(t('admin.ramo.confirma'))) { ramo.value = c.ramo ?? ''; return }
    ramo.disabled = true
    const r = await definirRamo(c.id, ramo.value)
    ramo.disabled = false
    if (r.erro) return aviso.replaceChildren(el('p', { class: 'erro', role: 'alert', texto: r.erro }))
    aviso.replaceChildren()
    await recarregar()
  })

  const atuais = new Set(c.redes ?? REDES)
  const todasCaixas = []
  const caixas = REDES.map((rede) => {
    const caixa = el('input', { type: 'checkbox', checked: atuais.has(rede) })
    todasCaixas.push(caixa)
    caixa.addEventListener('change', async () => {
      const novas = REDES.filter((x) => (x === rede ? caixa.checked : atuais.has(x)))
      const erro = (msg) => aviso.replaceChildren(el('p', { class: 'erro', role: 'alert', texto: msg }))
      if (!novas.length) { caixa.checked = true; return erro(t('admin.redes.minimo')) }
      todasCaixas.forEach((x) => { x.disabled = true }) // sem cliques em paralelo na mesma linha
      const r = await definirRedes(c.id, novas)
      todasCaixas.forEach((x) => { x.disabled = false })
      if (r.erro) { caixa.checked = !caixa.checked; return erro(r.erro) }
      atuais.clear(); novas.forEach((x) => atuais.add(x))
      aviso.replaceChildren()
    })
    return el('label', { class: 'rede-caixa' }, caixa, ' ', t('rede.' + rede))
  })

  // dias de post (plano do cliente)
  const freqAtual = c.frequencia ?? 'seg_sex'
  const frequencia = el('select', { class: 'pequeno', 'aria-label': t('admin.frequencia') + ': ' + c.nome },
    FREQUENCIAS.map((f) => el('option', { value: f, texto: t('freq.' + f), selected: f === freqAtual })))
  frequencia.addEventListener('change', async () => {
    if (!confirm(t('admin.frequencia.confirma'))) { frequencia.value = freqAtual; return }
    frequencia.disabled = true
    const r = await definirFrequencia(c.id, frequencia.value)
    frequencia.disabled = false
    if (r.erro) { frequencia.value = freqAtual; return aviso.replaceChildren(el('p', { class: 'erro', role: 'alert', texto: r.erro })) }
    aviso.replaceChildren()
    await recarregar()
  })

  const alterarNegocio = el('button', { type: 'button', class: 'secundario pequeno', texto: t('admin.negocio.alterar') })
  alterarNegocio.addEventListener('click', () => janelaNegocio(c, recarregar))
  const n = c.negocio

  const celula = (rotulo, ...filhos) => el('td', { 'data-rotulo': rotulo }, ...filhos)
  return el('tr', {},
    celula(t('admin.nome'), el('strong', { texto: c.nome })),
    celula(t('admin.negocio'),
      n ? el('strong', { texto: n.nome }) : el('span', { class: 'selo ruim', texto: t('admin.negocio.falta') }),
      n?.insta ? el('div', { class: 'muted', texto: n.insta }) : null,
      n ? el('div', { class: 'muted', texto: n.logo_path ? t('resumo.logo') : t('resumo.semlogo') }) : null,
      alterarNegocio),
    celula(t('admin.email'), c.email),
    celula(t('admin.telefone'), c.telefone),
    celula(t('admin.ramo'), ramo,
      c.ramo ? null : el('span', { class: 'selo ruim', texto: t('admin.semramo') })),
    celula(t('admin.redes'), el('div', { class: 'redes-admin' }, caixas)),
    celula(t('admin.frequencia'), frequencia),
    celula(t('admin.idioma'), c.idioma === 'es' ? t('admin.idioma.es') : t('admin.idioma.pt')),
    celula(t('admin.situacao'),
      el('span', { class: bloqueado ? 'selo ruim' : 'selo bom', texto: bloqueado ? t('admin.bloqueado') : t('admin.ativo') }),
      c.senha_provisoria ? el('span', { class: 'selo neutro', texto: t('admin.provisoria') }) : null),
    el('td', { class: 'acoes-linha' }, redefinir, alternar))
}
