// Perguntas do negócio como blocos independentes: cada uma devolve { titulo, corpo, validar? }.
// Servem ao quiz inicial, à página "Meu negócio" (uma pergunta por vez) e ao passo de itens do mês.
import { t } from '../textos.js'
import { el, campo } from '../comum.js'
import { temPromocao } from '../../../supabase/functions/_shared/modelos/validar.ts'
import { REDES } from '../../../supabase/functions/_shared/modelos/tipos.ts'
import { MAX_ITENS, LOGO_MAX, validarItens, normalizarInsta, reduzirFoto } from './negocio.js'
import { montarImportacao, faixaDeFotos } from './importarTela.js'

const HORARIOS = [['07:00', 'manha'], ['12:00', 'almoco'], ['19:00', 'noite']]
const ASSINATURAS = ['ambos', 'logo', 'insta']

export const PERGUNTAS_FIXAS = ['nome', 'marca', 'tom', 'horario', 'cores']

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
export function campoFoto(rotulo, { maximo, tipo, jaTem, aoEscolher }) {
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

// Estado editável a partir do que está salvo (negocio/produtos podem vir vazios).
export function estadoDoNegocio(negocio, produtos, ramo) {
  const n = negocio
  return {
    nome: n?.nome ?? '', insta: n?.insta ?? '', assinatura: n?.assinatura ?? 'ambos',
    tom: n?.tom ?? 'proximo', horario: n?.horario ?? '19:00',
    cor1: n?.cor1 ?? ramo.cores.cor1, cor2: n?.cor2 ?? ramo.cores.cor2,
    logo_path: n?.logo_path ?? null, logoBlob: null,
    itens: (produtos ?? []).map((p) => ({
      id: p.id, nome: p.nome, descricao: p.descricao ?? '',
      precoTexto: p.preco ? String(p.preco).replace('.', ',') : '',
      promoTexto: p.preco_promo ? String(p.preco_promo).replace('.', ',') : '',
      fotos: p.fotos?.length ? p.fotos.map((path) => ({ path })) : p.foto_path ? [{ path: p.foto_path }] : [],
    })),
  }
}

// Texto curto da resposta atual, para a página-resumo. Cores: a tela desenha os quadradinhos.
export function resumoDaPergunta(chave, estado, ramo) {
  if (chave === 'nome') return estado.nome
  if (chave === 'marca') {
    const partes = [estado.logo_path || estado.logoBlob ? t('resumo.logo') : null, estado.insta || null].filter(Boolean)
    return partes.length ? partes.join(' · ') : t('resumo.semlogo')
  }
  if (chave === 'tom') return ramo.tons.find(([v]) => v === estado.tom)?.[1] ?? ''
  if (chave === 'horario') {
    const h = HORARIOS.find(([v]) => v === estado.horario)
    return h ? t(`quiz.horario.${h[1]}`) : estado.horario
  }
  return ''
}

// 'Instagram, Facebook, ...' na ordem de REDES.
export function nomesDasRedes(redes) {
  return REDES.filter((r) => (redes ?? []).includes(r)).map((r) => t(`rede.${r}`)).join(', ')
}

const BLOCOS = {
  nome: ({ ramo, estado }) => {
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
  itens: ({ ramo, estado, supabase }) => {
    const lista = el('div', { class: 'itens' })
    let urls = [] // miniaturas temporárias; liberadas a cada redesenho
    const sugestoes = el('div', { class: 'chips' })
    const adicionar = el('button', { type: 'button', class: 'secundario', texto: t('quiz.item.adicionar') })
    const novo = (nome = '') => ({ id: crypto.randomUUID(), nome, descricao: '', precoTexto: '', promoTexto: '', fotos: [] })
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
        const [rPromo, iPromo] = campo(t('quiz.item.promo'), { value: item.promoTexto, inputmode: 'decimal', placeholder: 'Ex.: 39,90' })
        iPromo.addEventListener('input', () => { item.promoTexto = iPromo.value })
        preco = el('div', { class: 'precos' }, el('div', {}, rPreco, iPreco), el('div', {}, rPromo, iPromo))
      }
      const selos = el('span', { class: 'selos-item' })
      const remover = el('button', { type: 'button', class: 'secundario pequeno', texto: t('quiz.item.remover') })
      remover.addEventListener('click', () => { estado.itens.splice(estado.itens.indexOf(item), 1); redesenhar() })
      return el('fieldset', {},
        el('legend', { texto: `${ramo.itemOne} ${i + 1}` }), selos,
        rNome, iNome, el('label', { for: idDesc, texto: t('quiz.item.descricao') }), desc, preco,
        el('p', { class: 'rotulo', texto: t('quiz.item.fotos') }),
        faixaDeFotos({ item, supabase, urls, selos }),
        el('div', { class: 'acoes' }, remover))
    }

    function redesenhar() {
      for (const u of urls) URL.revokeObjectURL(u)
      urls = []
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
      corpo: [...montarImportacao({ ramo, estado, aoMudar: redesenhar }), el('p', { class: 'muted', texto: t('quiz.itens.dica', { max: MAX_ITENS }) }), sugestoes, lista, adicionar],
      validar: () => { const k = validarItens(estado.itens, ramo); return k ? t(k, { max: MAX_ITENS }) : null },
    }
  },
  tom: ({ ramo, estado }) => ({
    titulo: t('quiz.tom', { quem: ramo.quem }),
    corpo: opcoes('tom', ramo.tons, estado.tom, (v) => { estado.tom = v }),
  }),
  horario: ({ estado }) => ({
    titulo: t('quiz.horario'),
    corpo: opcoes('horario', HORARIOS.map(([v, k]) => [v, t(`quiz.horario.${k}`), t(`quiz.horario.${k}.desc`)]),
      estado.horario, (v) => { estado.horario = v }),
  }),
  marca: ({ estado }) => {
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
  cores: ({ ramo, estado }) => {
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
}

export function pergunta(chave, ctx) {
  const bloco = BLOCOS[chave]
  if (!bloco) throw new Error(`pergunta desconhecida: ${chave}`)
  return bloco(ctx)
}
