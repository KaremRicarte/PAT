// Perguntas do negócio como blocos independentes: cada uma devolve { titulo, corpo, validar? }.
// Servem ao quiz inicial, à página "Meu negócio" (uma pergunta por vez) e ao passo de itens do mês.
import { t } from '../textos.js'
import { el, campo } from '../comum.js'
import { REDES } from '../../../supabase/functions/_shared/modelos/tipos.ts'
import { datasParaPromocao, diaMes } from '../../../supabase/functions/_shared/modelos/datas.ts'
import { hojeEmSaoPaulo } from '../../../supabase/functions/_shared/modelos/calendario.ts'
import { MAX_ITENS, validarItens, MAX_FOTOS_NEGOCIO, itensRepetidos, textoDosRepetidos } from './negocio.js'
import { montarImportacao, faixaDeFotos } from './importarTela.js'
import { normalizarWhatsApp, formatarWhatsApp } from '../contato.js'
import { lerPacote, voltaAntesDaIda } from '../../../supabase/functions/_shared/modelos/pacote.ts'

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
    nome: n?.nome ?? '', insta: n?.insta ?? '',
    // WhatsApp como o cliente vê (formatado); salvarDadosNegocio guarda só os dígitos
    whatsapp: n?.whatsapp ? formatarWhatsApp(n.whatsapp) : '',
    assinatura: n?.assinatura ?? 'ambos',
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
      // caixinha "Ocultar preço": o preço fica salvo, mas os posts saem sem valor
      ocultarPreco: Boolean(p.ocultar_preco),
      // detalhes do pacote de viagem (Turismo); null = nunca preenchido
      pacote: lerPacote(p.pacote),
      fotos: p.fotos?.length ? p.fotos.map((path) => ({ path })) : p.foto_path ? [{ path: p.foto_path }] : [],
    })),
  }
}

// Texto curto da resposta atual, para a página-resumo. Cores: a tela desenha os quadradinhos.
export function resumoDaPergunta(chave, estado, ramo) {
  if (chave === 'marca') {
    const w = normalizarWhatsApp(estado.whatsapp)
    return [t(`quiz.assinatura.${estado.assinatura}`), w ? formatarWhatsApp(w) : null].filter(Boolean).join(' · ')
  }
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

// Caixinha "Ocultar preço" do item (igual à da data da promoção): o preço continua salvo, mas não aparece nos posts.
export function caixaOcultarPreco(item) {
  const id = `ocultar-preco-${item.id}`
  const marcar = el('input', { type: 'checkbox', id, checked: Boolean(item.ocultarPreco) })
  marcar.addEventListener('change', () => { item.ocultarPreco = marcar.checked })
  return el('div', { class: 'promo-data' },
    el('label', { class: 'caixinha', for: id }, marcar, el('span', { texto: t('quiz.item.ocultarpreco') })),
    el('p', { class: 'muted pequeno', texto: t('quiz.item.ocultarpreco.dica') }))
}

// Caixinha "Detalhes do pacote" (só Turismo): hotel, datas, transporte, transfer, refeições e condições do preço.
// Desmarcada, os valores ficam guardados (ativo: false) e os posts não usam.
function caixaDoPacote(item, precos) {
  const p = item.pacote ?? (item.pacote = lerPacote({}))
  const id = `pacote-${item.id}`
  const marcar = el('input', { type: 'checkbox', id, checked: p.ativo })
  const numero = (v) => (String(v).trim() === '' ? null : Number(v))
  // campo ligado a uma chave do pacote
  const ligado = (chave, rotulo, attrs, ler = (v) => v || null) => {
    const [r, i] = campo(rotulo, { ...attrs, value: p[chave] ?? '' })
    i.addEventListener('input', () => { p[chave] = ler(i.value) })
    return [r, i]
  }
  const caixinha = (nome, ler, gravar) => {
    const idc = `${id}-${nome}`
    const c = el('input', { type: 'checkbox', id: idc, checked: ler() })
    c.addEventListener('change', () => gravar(c.checked))
    return el('label', { class: 'caixinha', for: idc }, c, el('span', { texto: t(`quiz.item.pacote.${nome}`) }))
  }
  const [rHotel, iHotel] = ligado('hotel', t('quiz.item.pacote.hotel'), { maxlength: 80 })
  const [rIda, iIda] = ligado('ida', t('quiz.item.pacote.ida'), { type: 'date' })
  const [rVolta, iVolta] = ligado('volta', t('quiz.item.pacote.volta'), { type: 'date' })
  const passou = el('p', { class: 'muted pequeno', texto: t('quiz.item.pacote.passou') })
  const verPassou = () => { passou.hidden = !(p.ativo && p.ida && p.ida < hojeEmSaoPaulo()) }
  // volta antes da ida: aviso vermelho na hora, embaixo das datas (e a volta não deixa escolher dia antes da ida)
  const datasErradas = el('p', { class: 'erro', role: 'alert', texto: t('quiz.item.pacote.erro.volta') })
  const verDatas = () => {
    const errado = voltaAntesDaIda(p)
    datasErradas.hidden = !errado
    iVolta.setAttribute('aria-invalid', String(errado))
    if (p.ida) iVolta.min = p.ida; else iVolta.removeAttribute('min')
  }
  iIda.addEventListener('change', verPassou)
  for (const i of [iIda, iVolta]) for (const ev of ['input', 'change']) i.addEventListener(ev, verDatas)
  verDatas()
  const transporte = el('fieldset', { class: 'opcoes-pacote' }, el('legend', { texto: t('quiz.item.pacote.transporte') }),
    ...[['aviao', 'aviao'], ['onibus', 'onibus'], ['', 'sohospedagem']].map(([valor, nome]) => {
      const r = el('input', { type: 'radio', name: `${id}-transporte`, value: valor, checked: (p.transporte ?? '') === valor })
      r.addEventListener('change', () => { p.transporte = valor || null })
      return el('label', { class: 'caixinha' }, r, el('span', { texto: t(`quiz.item.pacote.${nome}`) }))
    }))
  const refeicoes = el('fieldset', { class: 'opcoes-pacote' }, el('legend', { texto: t('quiz.item.pacote.inclui') }),
    ...['cafe', 'almoco', 'jantar'].map((r) => caixinha(r, () => p.refeicoes[r], (v) => { p.refeicoes[r] = v })))
  const idPor = `${id}-precopor`
  const precoPor = el('select', { id: idPor },
    el('option', { value: '', texto: '—' }),
    ...['pessoa', 'casal', 'noite', 'pacote'].map((v) => el('option', { value: v, texto: t(`quiz.item.pacote.precopor.${v}`), selected: p.preco_por === v })))
  precoPor.addEventListener('change', () => { p.preco_por = precoPor.value || null })
  const [rParc, iParc] = ligado('parcelas', t('quiz.item.pacote.parcelas'), { type: 'number', min: 2, max: 24, inputmode: 'numeric' }, numero)
  const [rPix, iPix] = ligado('pix', t('quiz.item.pacote.pix'), { type: 'number', min: 1, max: 50, inputmode: 'numeric' }, numero)
  // "Preço nos posts": mostrar o preço ou "Entrar em contato para as condições" (guardado em ocultar_preco)
  const condicoes = el('div', { class: 'pacote-condicoes' },
    el('label', { for: idPor, texto: t('quiz.item.pacote.precopor') }), precoPor,
    el('div', { class: 'precos' }, el('div', {}, rParc, iParc), el('div', {}, rPix, iPix)),
    caixinha('taxas', () => p.taxas, (v) => { p.taxas = v }))
  const guardado = el('p', { class: 'muted pequeno', texto: t('quiz.item.pacote.preco.guardado') })
  const verCondicoes = () => { condicoes.hidden = Boolean(item.ocultarPreco); guardado.hidden = !item.ocultarPreco }
  const modoPreco = el('fieldset', { class: 'opcoes-pacote' }, el('legend', { texto: t('quiz.item.pacote.preconosposts') }),
    ...[[false, 'mostrar'], [true, 'contato']].map(([oculto, nome]) => {
      const r = el('input', { type: 'radio', name: `${id}-preco`, checked: Boolean(item.ocultarPreco) === oculto })
      r.addEventListener('change', () => { item.ocultarPreco = oculto; verCondicoes() })
      return el('label', { class: 'caixinha' }, r, el('span', { texto: t(`quiz.item.pacote.preco.${nome}`) }))
    }))
  verCondicoes()
  const detalhes = el('div', { class: 'promo-data-detalhes pacote-detalhes' },
    rHotel, iHotel,
    el('div', { class: 'precos' }, el('div', {}, rIda, iIda), el('div', {}, rVolta, iVolta)), datasErradas, passou,
    transporte,
    caixinha('transfer', () => p.transfer, (v) => { p.transfer = v }),
    refeicoes,
    precos, modoPreco, guardado, condicoes)
  const mostrar = () => { detalhes.hidden = !p.ativo; verPassou() }
  marcar.addEventListener('change', () => { p.ativo = marcar.checked; mostrar() })
  mostrar()
  return el('div', { class: 'promo-data' },
    el('label', { class: 'caixinha', for: id }, marcar, el('span', { texto: t('quiz.item.pacote') })), detalhes)
}

// Preço normal e promocional do item.
function camposDoPreco(item) {
  const [rPreco, iPreco] = campo(t('quiz.item.preco'), { value: item.precoTexto, inputmode: 'decimal', placeholder: 'Ex.: 49,90' })
  iPreco.addEventListener('input', () => { item.precoTexto = iPreco.value })
  const [rPromo, iPromo] = campo(t('quiz.item.promo'), { value: item.promoTexto, inputmode: 'decimal', placeholder: 'Ex.: 39,90' })
  iPromo.addEventListener('input', () => { item.promoTexto = iPromo.value })
  return el('div', { class: 'precos' }, el('div', {}, rPreco, iPreco), el('div', {}, rPromo, iPromo))
}

// Preço, data da promoção e (Turismo) detalhes do pacote, com o preço dentro deles; nos outros ramos, "Ocultar preço".
// Usado no cadastro dos itens e no "Refazer este post". Ramos sem preço: nada.
export function camposDePrecoDoItem(item, ramo, datas) {
  if (ramo.noPromo) return []
  if (ramo.id === 'turismo') return [caixaDaData(item, datas), caixaDoPacote(item, camposDoPreco(item))]
  return [camposDoPreco(item), caixaDaData(item, datas), caixaOcultarPreco(item)]
}

// WhatsApp da empresa (opcional): aparece nas artes de pacote e nas legendas.
function campoWhatsApp(estado) {
  const [r, i] = campo(t('quiz.whatsapp'), { type: 'tel', inputmode: 'tel', autocomplete: 'tel', maxlength: 20, placeholder: '(83) 99999-0000', value: estado.whatsapp })
  i.addEventListener('input', () => { estado.whatsapp = i.value })
  return el('div', { class: 'campo-whatsapp' }, r, i, el('p', { class: 'muted pequeno', texto: t('quiz.whatsapp.dica') }))
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
      // mexeu no nome: tira a marca de "nome repetido" (volta na próxima vez que tentar salvar, se ainda repetir)
      iNome.addEventListener('input', () => { item.nome = iNome.value; iNome.closest('fieldset')?.classList.remove('repetido') })
      const idDesc = `desc-${item.id}`
      const desc = el('textarea', { id: idDesc, rows: 2, maxlength: 300 })
      desc.value = item.descricao
      desc.addEventListener('input', () => { item.descricao = desc.value })
      const preco = camposDePrecoDoItem(item, ramo, datas)
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
      validar: () => {
        const k = validarItens(estado.itens, ramo)
        // itens com o mesmo nome: borda vermelha nos dois, a tela vai até o primeiro e a mensagem diz quais são
        const caixas = [...lista.children]
        caixas.forEach((c) => c.classList.remove('repetido'))
        if (k === 'quiz.itens.repetido') {
          const marcadas = itensRepetidos(estado.itens).flat().map((idx) => caixas[idx]).filter(Boolean)
          marcadas.forEach((c) => c.classList.add('repetido'))
          marcadas[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return t(k, { nomes: textoDosRepetidos(estado.itens, ramo.itemOne) })
        }
        return k ? t(k, { max: MAX_ITENS }) : null
      },
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
      campoWhatsApp(estado),
    ],
    validar: () => (normalizarWhatsApp(estado.whatsapp) === undefined ? t('quiz.whatsapp.erro') : null),
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
