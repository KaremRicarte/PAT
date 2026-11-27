// Monta o mês inteiro com os modelos prontos (sem IA). Determinística: o mesmo pacote dá o mesmo mês.
// Baseada na geração do PAT atual (bancada/index.html, generate/buildDemo/buildNeed/buildAprox/caption).
import type { Aprox, Estrategia, Frequencia, Item, Pilar, Ramo, Rede, Tom } from './tipos.ts'
import { ENGAJA_CTA, RAMOS, itemDoProduto } from './ramos/index.ts'
import { agendaDoMes } from './calendario.ts'
import { datasDoMes, diaMes } from './datas.ts'
import { fraseDoPacote, pacoteAtivo, resumoDoItem } from './pacote.ts'

export type Pacote = {
  ramo: string, estrategia: Estrategia, anoMes: string, inicio: string,
  negocio: { nome: string, insta: string | null, tom: Tom, horario: string },
  // preco_promo: preço promocional (menor que o preço = promoção; igual ou vazio = vitrine de preço).
  // promo_data: a promoção vale só perto desta data (aquecimento nos 7 dias antes e o dia); null = o mês todo.
  // pacote: detalhes do pacote de viagem (Turismo), como vêm do banco (modelos/pacote.ts)
  produtos: { id: string, nome: string, descricao: string | null, preco: number | null, preco_promo: number | null, promo_data?: string | null, pacote?: unknown,
    // Turismo: com o pacote marcado, true = "Entrar em contato para as condições" (sem valor nos posts)
    ocultar_preco?: boolean | null }[],
  // "Gerar outro": gira produtos e temas em n posições para sair um texto diferente no mesmo lugar.
  deslocamento?: number,
  // Redes escolhidas no quiz do mês; ausente = todas.
  redes?: readonly Rede[],
  // Dias de post do cliente (painel do admin); ausente = segunda a sexta.
  frequencia?: Frequencia,
}
export type PostGerado = {
  data: string, rede: Rede,
  tipo: 'feed' | 'stories' | 'video' | 'status' | 'lista',
  formato: 'arte' | 'carrossel' | 'montagem' | 'gravar' | 'texto',
  pilar: Pilar, titulo: string, legenda: string, hashtags: string[], horario: string,
  roteiro: string | null, produto_id: string | null, ordem: number,
  // Preço guardado no post (promoção: de/por; vitrine: só por; sem preço: os dois null).
  preco_de: number | null, preco_por: number | null,
  // data especial do post (tema do dia, ou aquecimento/dia de uma promoção com data); null = post comum
  ocasiao: Ocasiao | null,
}
// nome null = promoção marcada para um dia sem data comemorativa ("outro dia")
export type Ocasiao = { nome: string | null, data: string, fase: 'tema' | 'aquecimento' | 'dia' }

const MIX: Record<Estrategia, Record<Pilar, number>> = {
  vender: { demo: 0.5, aprox: 0.2, need: 0.3 },
  tempo: { demo: 0.4, aprox: 0.3, need: 0.3 },
  crescer: { demo: 0.2, aprox: 0.45, need: 0.35 },
  credibilidade: { demo: 0.25, aprox: 0.5, need: 0.25 },
}
const TEMAS_CONFIANCA = /bastidores|equipe|hist[oó]ria|cliente feliz|trajet[oó]ria/i
const ORDEM_REDE = { instagram: 0, facebook: 1, tiktok: 2, whatsapp: 3 }
const ORDEM_TIPO = { feed: 0, stories: 1, video: 2, status: 3, lista: 4 }

const unq = (s: string) => s.replace(/^"|"$/g, '')
const limitar = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
export const paragrafos = (...p: (string | null | undefined | false)[]) => p.filter(Boolean).join('\n\n')
// Igual ao selo da arte (situacao.js `dinheiro`): sem ",00" quando inteiro, duas casas quando fracionado.
export const brl = (v: number) => {
  const c = Math.round(v * 100) % 100 !== 0 ? 2 : 0
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }).replace(/\s/g, ' ')
}
const diaDaSemana = (data: string) => new Date(`${data}T00:00:00Z`).getUTCDay()

const girar = <T>(lista: readonly T[], n: number): T[] => {
  const k = lista.length ? n % lista.length : 0
  return [...lista.slice(k), ...lista.slice(0, k)]
}

function tagLoja(nome: string) {
  const t = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return '#' + (t || 'meunegocio')
}

type Produto = Pacote['produtos'][number]
type ItemDoMes = { pr: Produto, it: Item }
export type Tratamento = 'promo' | 'vitrine'
export type ItemComPreco = ItemDoMes & { trat: Tratamento }

// Promoção com data: vale do 7º dia antes até o próprio dia.
const JANELA_DIAS = 7
// Promoção de um mês seguinte: os meses antes dela já fazem a chamada, se ela estiver a até tantos dias do mês gerado.
const ANTECEDENCIA_DIAS = 120
export const pertoDaData = (data: string, alvo: string) =>
  data <= alvo && (Date.parse(`${alvo}T00:00:00Z`) - Date.parse(`${data}T00:00:00Z`)) / 86400000 <= JANELA_DIAS

// Como o preço do item aparece nos posts. Produto antigo sem preco_promo, com preço, é vitrine.
// Promoção com data: só é promoção perto da data (em `data`); sem `data` ou longe dela, vitrine.
// Turismo: o preço mora nos detalhes do pacote. Sem o pacote marcado, o item não tem preço nos posts; com
// "Entrar em contato", tem os dias de oferta (vitrine), sem valor.
export function tratamentoDoItem(pr: Pick<Produto, 'preco' | 'preco_promo' | 'promo_data' | 'pacote' | 'ocultar_preco'>, ramo: Ramo, data?: string | null): Tratamento | null {
  if (ramo.noPromo) return null
  if (ramo.id === 'turismo') {
    if (!pacoteAtivo(pr.pacote)) return null
    if (pr.ocultar_preco) return 'vitrine'
  }
  if (!pr.preco) return null
  if (pr.preco_promo == null || pr.preco_promo >= pr.preco) return 'vitrine'
  if (!pr.promo_data) return 'promo'
  return data && pertoDaData(data, pr.promo_data) ? 'promo' : 'vitrine'
}

// As datas especiais do mês (de `inicio` em diante) e os itens marcados para um dia do mês (com ou sem preço:
// sem preço, os posts da data saem sem valor).
// `extras`: os dias que entram no feed além da agenda normal (datas de tema e dias de promoção).
export function especiaisDoMes(p: Pick<Pacote, 'ramo' | 'anoMes' | 'inicio' | 'produtos'>) {
  const ramo = RAMOS[p.ramo]
  const datas = ramo ? datasDoMes(p.anoMes, ramo).filter((d) => d.data >= p.inicio) : []
  const comPromo = ramo && !ramo.noPromo ? p.produtos.filter((pr) => pr.promo_data && pr.promo_data.startsWith(p.anoMes) &&
    pr.promo_data >= p.inicio) : []
  const temas = datas.filter((d) => !d.soPromo)
  const extras = [...new Set([...temas.map((d) => d.data), ...comPromo.map((pr) => pr.promo_data!)])]
  return { datas, temas, comPromo, extras }
}

// A agenda que gerarMes usa (a normal mais os dias especiais): a validação do mês confere com ela.
export const agendaDoPacote = (p: Pick<Pacote, 'ramo' | 'anoMes' | 'inicio' | 'produtos' | 'estrategia' | 'frequencia'>) =>
  agendaDoMes(p.anoMes, p.inicio, p.estrategia, especiaisDoMes(p).extras, p.frequencia ?? 'seg_sex')

// Os dias do feed que levam post de preço, e o item de cada um (spec §5 e §9b).
// Promoções antes das vitrines, na ordem da lista; sextas e sábados primeiro; nunca mais que as vagas de demo.
export function diasDePreco(feed: readonly string[], itens: readonly ItemDoMes[], estrategia: Estrategia, ramo: Ramo) {
  const comTrat = itens.map((x) => ({ ...x, trat: tratamentoDoItem(x.pr, ramo) }))
  const comPreco = [...comTrat.filter((x) => x.trat === 'promo'), ...comTrat.filter((x) => x.trat === 'vitrine')] as ItemComPreco[]
  const quantos = Math.min(estrategia === 'vender' ? comPreco.length : Math.min(2, comPreco.length),
    Math.round(feed.length * MIX[estrategia].demo))
  const fimDeSemana = (d: string) => [5, 6].includes(diaDaSemana(d))
  const dias = [...feed.filter(fimDeSemana), ...feed.filter((d) => !fimDeSemana(d))].slice(0, quantos)
  return new Map(dias.map((d, i) => [d, comPreco[i]]))
}

// "Natal" -> "de Natal"; "Dia das Mães" -> "do Dia das Mães".
export const daData = (nome: string) => (/^Dia\b/.test(nome) ? `do ${nome}` : `de ${nome}`)
// "Oferta de Natal" / "Oferta do dia 12/12" (promoção marcada para um dia sem data comemorativa).
const nomeDaOferta = (o: Ocasiao) => (o.nome ? `Oferta ${daData(o.nome)}` : `Oferta do dia ${diaMes(o.data)}`)

// O parágrafo de valor que os posts de preço levam (promoção: de/por; vitrine: só por). Também usado pela IA.
// Promoção com data diz o prazo: no aquecimento, o dia; no próprio dia, "só hoje" (também com só o preço normal).
export function textoDoPreco(preco_de: number | null, preco_por: number, ocasiao: Ocasiao | null = null) {
  if (preco_de == null && ocasiao?.fase !== 'dia' && ocasiao?.fase !== 'aquecimento') return `Por ${brl(preco_por)}.`
  const valor = preco_de == null ? `por ${brl(preco_por)}` : `de ${brl(preco_de)} por ${brl(preco_por)}`
  const oferta = ocasiao?.nome ? nomeDaOferta(ocasiao) : 'Oferta'
  if (ocasiao?.fase === 'dia') return `${oferta}${ocasiao.nome ? ',' : ''} só hoje (${diaMes(ocasiao.data)}): ${valor}.`
  if (ocasiao?.fase === 'aquecimento') return `${oferta}${ocasiao.nome ? ',' : ''} só no dia ${diaMes(ocasiao.data)}: ${valor}.`
  return `De ${brl(preco_de)} por ${brl(preco_por)}. Aproveite enquanto durar!`
}

// Começo do título dos posts de promoção com data: "Oferta de Natal" / "Vem aí a oferta de Natal".
export const tituloDaOferta = (o: Ocasiao) =>
  o.fase === 'aquecimento' ? `Vem aí a ${nomeDaOferta(o).replace(/^O/, 'o')}` : nomeDaOferta(o)

// O parágrafo e os campos de preço de um item com tratamento.
// Pacote de viagem com "Entrar em contato para as condições": o dia de oferta sai sem valor.
export const TEXTO_CONTATO = 'Condições especiais: fale com a loja.'
const pedeContato = (pr: Produto) => Boolean(pr.ocultar_preco) && pacoteAtivo(pr.pacote) != null

function precoDoItem({ pr, trat }: ItemComPreco, ocasiao: Ocasiao | null = null) {
  if (pedeContato(pr)) return { texto: TEXTO_CONTATO, preco_de: null, preco_por: null }
  const preco = pr.preco!
  return trat === 'promo'
    ? { texto: textoDoPreco(preco, pr.preco_promo!, ocasiao), preco_de: preco, preco_por: pr.preco_promo! }
    : { texto: textoDoPreco(null, preco, ocasiao), preco_de: null, preco_por: preco }
}

// Partes de um post de feed antes de escolher o convite (o convite só é sorteado quando o post é aceito).
type Partes = {
  pilar: Pilar, titulo: string, formato: 'arte' | 'carrossel', gancho: string, meio: string,
  roteiro: string, produto_id: string | null, descricao: string | null, conviteProprio: string | null,
  preco: string, preco_de: number | null, preco_por: number | null,
  // a enquete do story do dia (pergunta curta e duas opções para o adesivo de enquete)
  enquete: Enquete,
}
type Enquete = { pergunta: string, opcoes: [string, string] }
const SEM_PRECO = { preco: '', preco_de: null, preco_por: null }

export function gerarMes(p: Pacote): PostGerado[] {
  const ramo = RAMOS[p.ramo]
  if (!ramo) throw new Error(`ramo desconhecido: ${p.ramo}`)
  if (!p.produtos.length) throw new Error('sem produtos')

  const agenda = agendaDoPacote(p)
  const especiais = especiaisDoMes(p)
  const desl = p.deslocamento ?? 0
  const itens: ItemDoMes[] = girar(p.produtos, desl).map((pr) => ({ pr, it: itemDoProduto(ramo, pr.nome) }))
  const L = itens.length
  const nome = p.negocio.nome
  const insta = p.negocio.insta ? (p.negocio.insta.startsWith('@') ? p.negocio.insta : `@${p.negocio.insta}`) : null
  const crescer = p.estrategia === 'crescer'

  let cta = 0
  const engaja = girar(ENGAJA_CTA, desl)
  const convite = () => unq(crescer ? engaja[cta++ % engaja.length] : ramo.convite[p.negocio.tom])
  const nomeItem = (it: Item) => (it.art ? `${it.art} ${it.curto}` : it.curto)
  const trocar = (s: string, it: Item) => s.replaceAll('{prod}', nomeItem(it)).replaceAll('{loja}', nome)
  const campo = (a: Aprox, i: number, it: Item) => unq(trocar(a.f[i]?.[1] ?? '', it))
  const tagsIG = (pilar: Pilar) => [...ramo.tags, ramo.ptags[pilar], tagLoja(nome)]
  const tagsFB = [tagLoja(nome), ramo.tags[0]]
  const siga = crescer && insta ? `Siga ${insta} para mais conteúdo sobre ${ramo.assunto}.` : ''

  const aproxFeed = girar(p.estrategia === 'credibilidade'
    ? [...ramo.aprox.filter((a) => TEMAS_CONFIANCA.test(a.tema)), ...ramo.aprox.filter((a) => !TEMAS_CONFIANCA.test(a.tema))]
    : ramo.aprox, desl)

  const out: Omit<PostGerado, 'ordem' | 'horario'>[] = []

  const usados: Record<Pilar, number> = { demo: 0, aprox: 0, need: 0 }
  const idx: Record<Pilar, number> = { demo: 0, aprox: 0, need: 0 }
  let anterior: Pilar | null = null, tituloAnterior = ''

  const demo = ({ pr, it }: ItemDoMes, titulo: string, preco: Pick<Partes, 'preco' | 'preco_de' | 'preco_por'>): Partes => ({
    // o post que mostra o serviço fica em arte única (a foto do serviço brilha nela); nos ramos só de texto, carrossel
    pilar: 'demo', titulo: limitar(titulo), formato: ramo.textOnly && !preco.preco ? 'carrossel' : 'arte',
    gancho: unq(it.gancho), meio: unq(it.beneficio), roteiro: `Como montar: ${it.demo}`,
    produto_id: pr.id, descricao: pr.descricao, conviteProprio: null, ...preco,
    enquete: { pergunta: `Você já conhece ${nomeItem(it)}?`, opcoes: ['Já conheço', 'Quero conhecer'] },
  })
  // a enquete de um tema de aproximação: a do próprio tema (se tiver 2 opções) ou "faz sentido?"
  const enqueteDoTema = (a: Aprox, it: Item): Enquete => {
    const abre = campo(a, 0, it), titulo = limitar(trocar(a.t, it), 70)
    const pergunta = abre.trim().endsWith('?') ? abre : `${titulo}: faz sentido para você?`
    return a.poll && a.poll.length >= 2 ? { pergunta, opcoes: [a.poll[0], a.poll[1]] } : { pergunta, opcoes: ['Faz sentido', 'Quero saber mais'] }
  }
  const montar = (pilar: Pilar): Partes => {
    if (pilar === 'demo') return demo(itens[idx.demo % L], ramo.titulo(itens[idx.demo % L].it), SEM_PRECO)
    if (pilar === 'need') {
      const { pr, it } = itens[(idx.need + 1) % L]
      return {
        // o feed é carrossel: as pessoas leem mais o texto nas páginas do que na legenda
        pilar, titulo: limitar(it.dor), formato: 'carrossel',
        gancho: unq(it.dorG), meio: unq(it.dorT), roteiro: `Como montar: ${it.sol}`,
        produto_id: pr.id, descricao: pr.descricao, conviteProprio: null, ...SEM_PRECO,
        enquete: { pergunta: unq(it.dorG), opcoes: ['Já aconteceu', 'Nunca'] },
      }
    }
    const a = aproxFeed[idx.aprox % aproxFeed.length], { it } = itens[idx.aprox % L]
    return {
      pilar, titulo: limitar(trocar(a.t, it)), formato: 'carrossel',
      gancho: campo(a, 0, it), meio: campo(a, 2, it), roteiro: `Como montar: ${campo(a, 1, it)}`,
      produto_id: null, descricao: null, conviteProprio: campo(a, 3, it), ...SEM_PRECO,
      enquete: enqueteDoTema(a, it),
    }
  }

  // Promoção com data: o post forte no dia e até 2 de aquecimento nos dias de feed da semana antes.
  // Os dias de tema (datas comemorativas) ficam para o post da data.
  const temas = new Map(especiais.temas.map((d) => [d.data, d]))
  const nomeDoDia = (d: string) => especiais.datas.find((x) => x.data === d)?.nome ?? null
  // o preço que o item tiver: promoção (de/por), só o normal (por) ou nenhum (o post da data sai sem valor)
  const vagas = new Map<string, { x: ItemDoMes & { trat: Tratamento | null }, ocasiao: Ocasiao }>()
  for (const x of itens.filter((x) => especiais.comPromo.includes(x.pr))) {
    const dia = x.pr.promo_data!, nome = nomeDoDia(dia), item = { ...x, trat: tratamentoDoItem(x.pr, ramo, dia) }
    if (!vagas.has(dia)) vagas.set(dia, { x: item, ocasiao: { nome, data: dia, fase: 'dia' } })
    agenda.feed.filter((d) => d < dia && pertoDaData(d, dia) && !vagas.has(d) && !temas.has(d)).slice(-2)
      .forEach((d) => vagas.set(d, { x: item, ocasiao: { nome, data: dia, fase: 'aquecimento' } }))
  }
  // Promoção marcada para um mês seguinte (até ANTECEDENCIA_DIAS): o mês já faz a chamada ("Vem aí"), em 2 dias de
  // feed livres (um no meio e um no fim do mês). No máximo 2 promoções assim por mês, para não tomar o feed.
  if (!ramo.noPromo) {
    const fimDoMes = `${p.anoMes}-31`
    const futuras = itens.filter((x) => x.pr.promo_data && x.pr.promo_data > fimDoMes &&
      (Date.parse(`${x.pr.promo_data}T00:00:00Z`) - Date.parse(`${p.inicio}T00:00:00Z`)) / 86400000 <= ANTECEDENCIA_DIAS)
      .sort((a, b) => a.pr.promo_data!.localeCompare(b.pr.promo_data!)).slice(0, 2)
    futuras.forEach((x, k) => {
      const dia = x.pr.promo_data!
      const nome = datasDoMes(dia.slice(0, 7), ramo).find((d) => d.data === dia)?.nome ?? null
      const item = { ...x, trat: tratamentoDoItem(x.pr, ramo, dia) }
      const livres = agenda.feed.filter((d) => !vagas.has(d) && !temas.has(d))
      if (!livres.length) return
      const escolhas = [Math.floor(livres.length * (0.35 + 0.1 * k)), Math.floor(livres.length * (0.8 + 0.1 * k))]
        .map((i) => livres[Math.min(i, livres.length - 1)])
      for (const d of new Set(escolhas)) vagas.set(d, { x: item, ocasiao: { nome, data: dia, fase: 'aquecimento' } })
    })
  }
  // pacote de viagem (Turismo): os detalhes vão junto do preço; sem preço, no fim do meio
  const comPacote = (pr: ItemDoMes['pr'], texto: string) => {
    const r = resumoDoItem(p.ramo, pr.pacote, !pr.ocultar_preco)
    return r ? `${texto} ${fraseDoPacote(r)}` : texto
  }
  const montarOferta = ({ x, ocasiao }: { x: ItemDoMes & { trat: Tratamento | null }, ocasiao: Ocasiao }): Partes => {
    const titulo = `${tituloDaOferta(ocasiao)}: ${ramo.titulo(x.it)}`
    if (!x.trat) {
      const partes = demo(x, titulo, SEM_PRECO)
      const r = resumoDoItem(p.ramo, x.pr.pacote, false)
      return r ? { ...partes, meio: `${partes.meio} ${fraseDoPacote(r)}` } : partes
    }
    const { texto, ...campos } = precoDoItem({ ...x, trat: x.trat }, ocasiao)
    return demo(x, titulo, { preco: comPacote(x.pr, texto), ...campos })
  }

  // A enquete do story do dia: a da oferta da data, a da data comemorativa ou a da pauta.
  const enqueteDoDia = (partes: Partes, ocasiao: Ocasiao | null): Enquete => {
    if (ocasiao?.fase === 'aquecimento') return { pergunta: `${tituloDaOferta(ocasiao)}. Quer ser avisado no dia?`, opcoes: ['Quero!', 'Agora não'] }
    if (ocasiao?.fase === 'dia') return { pergunta: `${nomeDaOferta(ocasiao)}: é só hoje. Vai aproveitar?`, opcoes: ['Vou!', 'Quero detalhes'] }
    const tema = ocasiao?.fase === 'tema' ? temas.get(ocasiao.data) : null
    if (tema?.promo) return { pergunta: `${tema.nome}: você vai comemorar?`, opcoes: ['Vou sim', 'Ainda não sei'] }
    return partes.enquete
  }

  // Dia de preço: post de demonstração do item, com o preço (vale para todos os posts do dia).
  const livres = agenda.feed.filter((d) => !vagas.has(d) && !temas.has(d))
  const precoDoDia = diasDePreco(livres, itens, p.estrategia, ramo)
  const montarPreco = (x: ItemComPreco): Partes => {
    const { texto, ...campos } = precoDoItem(x)
    const titulo = x.trat === 'promo' ? 'Oferta: ' + ramo.titulo(x.it) : ramo.titulo(x.it)
    return demo(x, titulo, { preco: comPacote(x.pr, texto), ...campos })
  }

  // ---- Um conteúdo por dia de post (a pauta), adaptado para cada rede ----
  // Instagram post, Facebook, story (em enquete) e status em todo dia; a lista do WhatsApp 1x por semana;
  // o vídeo 2x por semana (agenda). Preço, promoção com data e a data especial valem para todos os posts do dia.
  const listas = new Set(agenda.lista), videos = new Set(agenda.videos)
  agenda.feed.forEach((data, i) => {
    const mix = MIX[p.estrategia]
    const ordem = (['demo', 'aprox', 'need'] as Pilar[])
      .map((k) => ({ k, s: mix[k] * (i + 1) - usados[k] - (k === anterior ? 0.6 : 0) }))
      .sort((x, y) => y.s - x.s).map((x) => x.k)
    const vaga = vagas.get(data)
    const doDia = vaga ? undefined : precoDoDia.get(data)
    const tema = temas.get(data)
    const ocasiao: Ocasiao | null = vaga?.ocasiao ?? (tema ? { nome: tema.nome, data, fase: 'tema' } : null)
    // evita o mesmo título em dois dias seguidos (ex.: um item só)
    const partes = vaga ? montarOferta(vaga) : doDia ? montarPreco(doDia)
      : ordem.map((k) => montar(k)).find((x) => x.titulo !== tituloAnterior) ?? montar(ordem[0])
    // o dia de preço conta como demo, mas não anda a fila dos demos sem preço
    usados[partes.pilar]++
    if (!doDia && !vaga) idx[partes.pilar]++
    anterior = partes.pilar; tituloAnterior = partes.titulo

    const conv = crescer || !partes.conviteProprio ? convite() : partes.conviteProprio
    const precos = { preco_de: partes.preco_de, preco_por: partes.preco_por }
    const comum = { data, pilar: partes.pilar, produto_id: partes.produto_id, ...precos, ocasiao }
    const base = { ...comum, formato: partes.formato, titulo: partes.titulo, roteiro: partes.roteiro }
    out.push({ ...base, rede: 'instagram', tipo: 'feed', hashtags: tagsIG(partes.pilar),
      legenda: paragrafos(partes.gancho, partes.meio, partes.preco, conv, siga) })
    out.push({ ...base, rede: 'facebook', tipo: 'feed', hashtags: tagsFB,
      legenda: paragrafos(partes.gancho, partes.meio, partes.descricao, partes.preco, conv, siga,
        `${nome}${insta ? ` · Instagram ${insta}` : ''}`) })

    // story: a pauta do dia virada enquete (a pergunta na arte; as duas opções para o adesivo de enquete)
    const q = enqueteDoDia(partes, ocasiao)
    out.push({ ...comum, rede: 'instagram', tipo: 'stories', formato: 'arte', titulo: limitar(q.pergunta),
      legenda: paragrafos(q.pergunta, partes.preco, `Enquete: ${q.opcoes[0]} / ${q.opcoes[1]}`),
      hashtags: [], roteiro: `Como montar: a pergunta na arte e o adesivo de enquete com "${q.opcoes[0]}" e "${q.opcoes[1]}".` })

    out.push({ ...comum, rede: 'whatsapp', tipo: 'status', formato: 'texto', titulo: partes.titulo,
      legenda: paragrafos(partes.gancho, partes.preco, conv), hashtags: [], roteiro: null })

    if (listas.has(data)) {
      out.push({ ...comum, rede: 'whatsapp', tipo: 'lista', formato: 'texto', titulo: limitar(`Mensagem para a lista: ${partes.titulo}`),
        legenda: paragrafos(`Oi! Aqui é ${nome}.`, partes.gancho, partes.meio, partes.preco, conv), hashtags: [], roteiro: null })
    }

    if (videos.has(data)) {
      // com item: montagem com as fotos dele; assunto geral: roteiro para gravar
      const item = partes.produto_id ? itens.find((x) => x.pr.id === partes.produto_id) : null
      out.push({ ...comum, rede: 'tiktok', tipo: 'video', formato: item ? 'montagem' : 'gravar', titulo: partes.titulo,
        legenda: paragrafos(partes.gancho, partes.preco, conv), hashtags: tagsIG(partes.pilar),
        roteiro: (item
          ? [`1. Abertura (texto na tela): ${partes.gancho}`, `2. Fotos de ${item.pr.nome}: ${item.it.demo}`, `3. Fechamento: ${conv}`]
          : [`1. Abertura: ${partes.gancho}`, `2. Conteúdo: ${partes.meio}`, `3. Fechamento: ${conv}`]).join('\n') })
    }
  })

  return out
    .map((x, i) => ({ x, i }))
    .sort((a, b) => a.x.data.localeCompare(b.x.data) || ORDEM_REDE[a.x.rede] - ORDEM_REDE[b.x.rede] ||
      ORDEM_TIPO[a.x.tipo] - ORDEM_TIPO[b.x.tipo] || a.i - b.i)
    .map(({ x }, ordem) => ({ ...x, horario: p.negocio.horario, ordem }))
    // Filtra só no fim: os textos e a ordem das redes escolhidas ficam iguais aos do mês completo
    // (o "Gerar outro" regera o mês completo e procura o mesmo lugar).
    .filter((x) => !p.redes || p.redes.includes(x.rede))
}
