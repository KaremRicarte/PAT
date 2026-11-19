// Perguntas do negócio como blocos independentes: cada uma devolve { titulo, corpo, validar? }.
// Servem ao quiz inicial, à página "Meu negócio" (uma pergunta por vez) e ao passo de itens do mês.
import { t } from '../textos.js'
import { el, campo } from '../comum.js'
import { REDES } from '../../../supabase/functions/_shared/modelos/tipos.ts'
import { datasParaPromocao, diaMes } from '../../../supabase/functions/_shared/modelos/datas.ts'
import { hojeEmSaoPaulo } from '../../../supabase/functions/_shared/modelos/calendario.ts'
import { MAX_ITENS, validarItens, MAX_FOTOS_NEGOCIO } from './negocio.js'
import { montarImportacao, faixaDeFotos } from './importarTela.js'

const HORARIOS = [['07:00', 'manha'], ['12:00', 'almoco'], ['19:00', 'noite']]
const ASSINATURAS = ['ambos', 'logo', 'insta']

// Nome, Instagram e logo são da administração: aparecem só para leitura (ver identidadeDoNegocio).
export const PERGUNTAS_FIXAS = ['marca', 'tom', 'horario', 'cores']

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

// Estado editável a partir do que está salvo (negocio/produtos podem vir vazios).
export function estadoDoNegocio(negocio, produtos, ramo) {
  const n = negocio
  return {
    nome: n?.nome ?? '', insta: n?.insta ?? '', assinatura: n?.assinatura ?? 'ambos',
    tom: n?.tom ?? 'proximo', horario: n?.horario ?? '19:00',
    cor1: n?.cor1 ?? ramo.cores.cor1, cor2: n?.cor2 ?? ramo.cores.cor2,
    logo_path: n?.logo_path ?? null,
    fotosNegocio: (n?.fotos ?? []).map((path) => ({ path })),
    itens: (produtos ?? []).map((p) => ({
      id: p.id, nome: p.nome, descricao: p.descricao ?? '',
      precoTexto: p.preco ? String(p.preco).replace('.', ',') : '',
      promoTexto: p.preco_promo ? String(p.preco_promo).replace('.', ',') : '',
      // null = sem data (a promoção vale o mês todo)
      promoData: p.promo_data ?? null,
      fotos: p.fotos?.length ? p.fotos.map((path) => ({ path })) : p.foto_path ? [{ path: p.foto_path }] : [],
    })),
  }
}

// Texto curto da resposta atual, para a página-resumo. Cores: a tela desenha os quadradinhos.
export function resumoDaPergunta(chave, estado, ramo) {
  if (chave === 'marca') return t(`quiz.assinatura.${estado.assinatura}`)
  if (chave === 'fotos') {
    const n = estado.fotosNegocio?.length ?? 0
    return n === 0 ? t('resumo.fotos.nenhuma') : n === 1 ? t('resumo.fotos.1') : t('resumo.fotos.n', { n })
  }
  if (chave === 'tom') return ramo.tons.find(([v]) => v === estado.tom)?.[1] ?? ''
  if (chave === 'horario') {
    const h = HORARIOS.find(([v]) => v === estado.horario)
    return h ? t(`quiz.horario.${h[1]}`) : estado.horario
  }
  return ''
}

// "Malibu Turismo · @malibu · logo": o que a administração configurou (só leitura para o cliente).
export function identidadeDoNegocio(estado) {
  return [estado.nome, estado.insta || null, estado.logo_path ? t('resumo.logo') : t('resumo.semlogo')].filter(Boolean).join(' · ')
}

// 'Instagram, Facebook, ...' na ordem de REDES.
export function nomesDasRedes(redes) {
  return REDES.filter((r) => (redes ?? []).includes(r)).map((r) => t(`rede.${r}`)).join(', ')
}

// "Promoção só para uma data especial": marca e escolhe a data (das próximas datas boas ou outro dia).
// item.promoData: null = sem data; '' = marcada, falta escolher o dia; 'AAAA-MM-DD' = o dia.
export function caixaDaData(item, datas) {
  const id = `promo-data-${item.id}`
  const marcar = el('input', { type: 'checkbox', id, checked: item.promoData != null })
  const OUTRO = 'outro'
  const lista = el('select', { 'aria-label': t('quiz.item.promodata.qual') },
    ...datas.map((d) => el('option', { value: d.data, texto: `${diaMes(d.data)} · ${d.nome}` })),
    el('option', { value: OUTRO, texto: t('quiz.item.promodata.outro') }))
  const [rDia, iDia] = campo(t('quiz.item.promodata.dia'), { type: 'date', min: hojeEmSaoPaulo() })
  const outro = el('div', { class: 'promo-outro' }, rDia, iDia)
  const passou = el('p', { class: 'muted pequeno', texto: t('quiz.item.promodata.passou') })
  const detalhes = el('div', { class: 'promo-data-detalhes' }, lista, outro, passou,
    el('p', { class: 'muted pequeno', texto: t('quiz.item.promodata.dica') }))
  const daLista = () => datas.some((d) => d.data === item.promoData)
  function mostrar() {
    detalhes.hidden = item.promoData == null
    lista.value = item.promoData && daLista() ? item.promoData : OUTRO
    outro.hidden = lista.value !== OUTRO
    iDia.value = item.promoData && !daLista() ? item.promoData : ''
    passou.hidden = !(item.promoData && item.promoData < hojeEmSaoPaulo())
  }
  marcar.addEventListener('change', () => { item.promoData = marcar.checked ? (datas[0]?.data ?? '') : null; mostrar() })
  lista.addEventListener('change', () => { item.promoData = lista.value === OUTRO ? '' : lista.value; mostrar(); if (lista.value === OUTRO) iDia.focus() })
  iDia.addEventListener('change', () => { item.promoData = iDia.value || ''; passou.hidden = !(item.promoData && item.promoData < hojeEmSaoPaulo()) })
  mostrar()
  return el('div', { class: 'promo-data' }, el('label', { class: 'caixinha', for: id }, marcar, el('span', { texto: t('quiz.item.promodata') })), detalhes)
}

const BLOCOS = {
  itens: ({ ramo, estado, supabase, fotosInfo }) => {
    const lista = el('div', { class: 'itens' })
    let urls = [] // miniaturas temporárias; liberadas a cada redesenho
    const sugestoes = el('div', { class: 'chips' })
    const adicionar = el('button', { type: 'button', class: 'secundario', texto: t('quiz.item.adicionar') })
    const novo = (nome = '') => ({ id: crypto.randomUUID(), nome, descricao: '', precoTexto: '', promoTexto: '', promoData: null, fotos: [] })
    const datas = ramo.noPromo ? [] : datasParaPromocao(hojeEmSaoPaulo(), ramo)
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
        preco = [el('div', { class: 'precos' }, el('div', {}, rPreco, iPreco), el('div', {}, rPromo, iPromo)),
          caixaDaData(item, datas)]
      }
      const selos = el('span', { class: 'selos-item' })
      const remover = el('button', { type: 'button', class: 'secundario pequeno', texto: t('quiz.item.remover') })
      remover.addEventListener('click', () => { estado.itens.splice(estado.itens.indexOf(item), 1); redesenhar() })
      return el('fieldset', {},
        el('legend', { texto: `${ramo.itemOne} ${i + 1}` }), selos,
        rNome, iNome, el('label', { for: idDesc, texto: t('quiz.item.descricao') }), desc, preco,
        el('p', { class: 'rotulo', texto: t('quiz.item.fotos') }),
        faixaDeFotos({ item, supabase, urls, selos, fotosInfo }),
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
  fotos: ({ estado, supabase, fotosInfo }) => {
    const item = { nome: t('meu.rotulo.fotos'), fotos: estado.fotosNegocio }
    const selos = el('span', { class: 'selos-item' })
    return {
      titulo: t('meu.rotulo.fotos'),
      corpo: [el('p', { class: 'muted', texto: t('meu.fotos.dica', { max: MAX_FOTOS_NEGOCIO }) }),
        faixaDeFotos({ item, supabase, urls: [], selos, fotosInfo, max: MAX_FOTOS_NEGOCIO })],
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
  marca: ({ estado }) => ({
    titulo: t('quiz.assinatura'),
    corpo: [
      el('div', { class: 'identidade' },
        el('strong', { texto: identidadeDoNegocio(estado) }),
        el('small', { class: 'muted', texto: t('meu.identidade.aviso') })),
      opcoes('assinatura', ASSINATURAS.map((v) => [v, t(`quiz.assinatura.${v}`)]), estado.assinatura,
        (v) => { estado.assinatura = v }),
    ],
  }),
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
