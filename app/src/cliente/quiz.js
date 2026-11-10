// Quiz do negócio: uma pergunta por tela. O ramo vem do cadastro feito pela administradora.
import { t } from '../textos.js'
import { el, logo, campo, mostrar } from '../comum.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'
import { temPromocao } from '../../../supabase/functions/_shared/modelos/validar.ts'
import {
  MAX_ITENS, FOTO_MAX, LOGO_MAX, validarItens, precoDoTexto, normalizarInsta, reduzirFoto, salvarNegocio,
} from './negocio.js'

const HORARIOS = [['07:00', 'manha'], ['12:00', 'almoco'], ['19:00', 'noite']]
const ASSINATURAS = ['ambos', 'logo', 'insta']

// Lista de opções em cartões (rádio). `lista`: [valor, rótulo, descrição?, selo?]
export function opcoes(nome, lista, atual, aoMudar) {
  return el('div', { class: 'opcoes', role: 'radiogroup' }, lista.map(([valor, rotulo, desc, selo]) => {
    const radio = el('input', { type: 'radio', name: nome, value: valor, checked: valor === atual })
    radio.addEventListener('change', () => aoMudar(valor))
    return el('label', { class: 'cartao' }, radio,
      el('span', {}, el('strong', { texto: rotulo }), selo ? el('span', { class: 'selo bom', texto: selo }) : null,
        desc ? el('small', { texto: desc }) : null))
  }))
}

// Campo de arquivo de imagem que já reduz a foto no aparelho e mostra o resultado.
function campoFoto(rotulo, { maximo, tipo, jaTem, aoEscolher }) {
  const id = `foto-${crypto.randomUUID()}`
  const status = el('p', { class: 'muted pequeno', texto: jaTem ? t('quiz.foto.salva') : '' })
  const input = el('input', { id, type: 'file', accept: 'image/jpeg,image/png,image/webp,image/*' })
  input.addEventListener('change', async () => {
    const arquivo = input.files?.[0]
    if (!arquivo) return
    status.className = 'muted pequeno'
    status.textContent = t('comum.carregando')
    try {
      aoEscolher(await reduzirFoto(arquivo, maximo, tipo))
      status.textContent = t('quiz.foto.ok')
    } catch (e) {
      console.error(e)
      input.value = ''
      status.className = 'erro pequeno'
      status.textContent = t('quiz.foto.erro')
    }
  })
  return [el('label', { for: id, texto: rotulo }), input, status]
}

export function telaQuiz({ supabase, cliente, inicial, aoSalvar, aoCancelar }) {
  const ramo = RAMOS[cliente.ramo]
  const n = inicial?.negocio
  const estado = {
    nome: n?.nome ?? '', insta: n?.insta ?? '', assinatura: n?.assinatura ?? 'ambos',
    tom: n?.tom ?? 'proximo', horario: n?.horario ?? '19:00',
    cor1: n?.cor1 ?? ramo.cores.cor1, cor2: n?.cor2 ?? ramo.cores.cor2,
    logo_path: n?.logo_path ?? null, logoBlob: null,
    itens: (inicial?.produtos ?? []).map((p) => ({
      id: p.id, nome: p.nome, descricao: p.descricao ?? '',
      precoTexto: p.preco ? String(p.preco).replace('.', ',') : '', foto_path: p.foto_path, fotoBlob: null,
    })),
  }

  const passos = [
    // 1. nome
    () => {
      const [rotulo, input] = campo(ramo.nomeQ, { name: 'nome', value: estado.nome, maxlength: 80, autocomplete: 'organization' })
      input.addEventListener('input', () => { estado.nome = input.value })
      return {
        titulo: t('quiz.nome.titulo'), corpo: [rotulo, input],
        validar: () => {
          if (estado.nome.trim().length < 2) return t('quiz.nome.erro')
          return ramo.noPromo && temPromocao(estado.nome) ? t('quiz.nome.promo') : null
        },
      }
    },
    // 2. itens (produtos, serviços ou temas)
    () => {
      const lista = el('div', { class: 'itens' })
      const sugestoes = el('div', { class: 'chips' })
      const adicionar = el('button', { type: 'button', class: 'secundario', texto: t('quiz.item.adicionar') })
      const novo = (nome = '') => ({ id: crypto.randomUUID(), nome, descricao: '', precoTexto: '', foto_path: null, fotoBlob: null })
      adicionar.addEventListener('click', () => { estado.itens.push(novo()); redesenhar(); lista.querySelector('fieldset:last-child input')?.focus() })

      const editor = (item, i) => {
        const [rNome, iNome] = campo(t('quiz.item.nome'), { value: item.nome, maxlength: 80 })
        iNome.addEventListener('input', () => { item.nome = iNome.value })
        const idDesc = `desc-${item.id}`
        const desc = el('textarea', { id: idDesc, rows: 2, maxlength: 300 })
        desc.value = item.descricao
        desc.addEventListener('input', () => { item.descricao = desc.value })
        let preco = null
        if (!ramo.noPromo) {
          const [rPreco, iPreco] = campo(t('quiz.item.preco'), { value: item.precoTexto, inputmode: 'decimal', placeholder: 'Ex.: 49,90' })
          iPreco.addEventListener('input', () => { item.precoTexto = iPreco.value })
          preco = [rPreco, iPreco]
        }
        const remover = el('button', { type: 'button', class: 'secundario pequeno', texto: t('quiz.item.remover') })
        remover.addEventListener('click', () => { estado.itens.splice(estado.itens.indexOf(item), 1); redesenhar() })
        return el('fieldset', {},
          el('legend', { texto: `${ramo.itemOne} ${i + 1}` }),
          rNome, iNome, el('label', { for: idDesc, texto: t('quiz.item.descricao') }), desc, preco,
          campoFoto(t('quiz.item.foto'), {
            maximo: FOTO_MAX, tipo: 'image/jpeg', jaTem: !!item.foto_path, aoEscolher: (b) => { item.fotoBlob = b },
          }),
          el('div', { class: 'acoes' }, remover))
      }

      function redesenhar() {
        lista.replaceChildren(...estado.itens.map(editor))
        const usados = new Set(estado.itens.map((i) => i.nome.trim().toLowerCase()))
        const cheio = estado.itens.length >= MAX_ITENS
        sugestoes.replaceChildren(...(cheio ? [] : ramo.lib.filter((l) => !usados.has(l.nome.toLowerCase())).map((l) => {
          const chip = el('button', { type: 'button', class: 'chip', texto: `+ ${l.nome}` })
          chip.addEventListener('click', () => { estado.itens.push(novo(l.nome)); redesenhar() })
          return chip
        })))
        adicionar.hidden = cheio
      }
      redesenhar()
      return {
        titulo: ramo.itensQ,
        corpo: [el('p', { class: 'muted', texto: t('quiz.itens.dica', { max: MAX_ITENS }) }), sugestoes, lista, adicionar],
        validar: () => { const k = validarItens(estado.itens, ramo); return k ? t(k, { max: MAX_ITENS }) : null },
      }
    },
    // 3. tom de voz
    () => ({
      titulo: t('quiz.tom', { quem: ramo.quem }),
      corpo: opcoes('tom', ramo.tons, estado.tom, (v) => { estado.tom = v }),
    }),
    // 4. horário
    () => ({
      titulo: t('quiz.horario'),
      corpo: opcoes('horario', HORARIOS.map(([v, k]) => [v, t(`quiz.horario.${k}`), t(`quiz.horario.${k}.desc`)]),
        estado.horario, (v) => { estado.horario = v }),
    }),
    // 5. logo, @ e assinatura
    () => {
      const [rInsta, iInsta] = campo(t('quiz.insta'), { value: estado.insta ?? '', placeholder: '@seunegocio', autocomplete: 'off', maxlength: 31 })
      iInsta.addEventListener('input', () => { estado.insta = iInsta.value })
      return {
        titulo: t('quiz.marca'),
        corpo: [
          campoFoto(t('quiz.logo'), {
            maximo: LOGO_MAX, tipo: 'image/png', jaTem: !!estado.logo_path, aoEscolher: (b) => { estado.logoBlob = b },
          }),
          rInsta, iInsta,
          el('p', { class: 'rotulo', texto: t('quiz.assinatura') }),
          opcoes('assinatura', ASSINATURAS.map((v) => [v, t(`quiz.assinatura.${v}`)]), estado.assinatura,
            (v) => { estado.assinatura = v }),
        ],
        validar: () => (normalizarInsta(estado.insta) === undefined ? t('quiz.insta.erro') : null),
      }
    },
    // 6. cores
    () => {
      const previa = el('div', { class: 'previa-cores', texto: estado.nome || ramo.nome })
      const pintar = () => { previa.style.background = estado.cor2; previa.style.color = estado.cor1 }
      const cor = (chave) => {
        const [r, i] = campo(t(`quiz.${chave}`), { type: 'color', value: estado[chave] })
        i.addEventListener('input', () => { estado[chave] = i.value; pintar() })
        return [r, i]
      }
      pintar()
      return { titulo: t('quiz.cores'), corpo: [cor('cor1'), cor('cor2'), previa] }
    },
  ]

  let atual = 0
  desenhar()

  function desenhar() {
    const { titulo, corpo, validar } = passos[atual]()
    const ultimo = atual === passos.length - 1
    const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
    const continuar = el('button', { type: 'submit', texto: t(ultimo ? 'quiz.salvar' : 'quiz.continuar') })
    const voltar = el('button', { type: 'button', class: 'secundario', texto: t('quiz.voltar') })
    voltar.hidden = atual === 0 && !aoCancelar
    voltar.addEventListener('click', () => {
      if (atual === 0) return aoCancelar()
      atual--
      desenhar()
    })

    const form = el('form', { novalidate: true, class: 'quiz' },
      el('p', { class: 'muted passo', texto: t('quiz.passo', { n: atual + 1, total: passos.length }) }),
      el('span', { class: 'selo neutro', texto: t('quiz.ramo', { ramo: ramo.nome }) }),
      el('h1', { texto: titulo }), corpo, erro,
      el('div', { class: 'acoes' }, continuar, voltar))

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      const msg = validar?.()
      if (msg) { erro.textContent = msg; erro.hidden = false; return }
      if (!ultimo) { atual++; desenhar(); window.scrollTo(0, 0); return }
      continuar.disabled = true
      erro.hidden = true
      try {
        await salvarNegocio(supabase, cliente.id,
          { ...estado, insta: normalizarInsta(estado.insta) },
          estado.itens.map((i) => ({ ...i, preco: ramo.noPromo ? null : precoDoTexto(i.precoTexto) })))
        await aoSalvar()
      } catch (e) {
        console.error(e)
        erro.textContent = t('erro.geral')
        erro.hidden = false
        continuar.disabled = false
      }
    })
    mostrar(logo(), form)
  }
}
