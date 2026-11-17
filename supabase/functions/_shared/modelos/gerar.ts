// Monta o mês inteiro com os modelos prontos (sem IA). Determinística: o mesmo pacote dá o mesmo mês.
// Baseada na geração do PAT atual (bancada/index.html, generate/buildDemo/buildNeed/buildAprox/caption).
import type { Aprox, Estrategia, Item, Pilar, Ramo, Rede, Tom } from './tipos.ts'
import { ENGAJA_CTA, RAMOS, itemDoProduto } from './ramos/index.ts'
import { agendaDoMes } from './calendario.ts'

export type Pacote = {
  ramo: string, estrategia: Estrategia, anoMes: string, inicio: string,
  negocio: { nome: string, insta: string | null, tom: Tom, horario: string },
  // preco_promo: preço promocional (menor que o preço = promoção; igual ou vazio = vitrine de preço).
  produtos: { id: string, nome: string, descricao: string | null, preco: number | null, preco_promo: number | null }[],
  // "Gerar outro": gira produtos e temas em n posições para sair um texto diferente no mesmo lugar.
  deslocamento?: number,
  // Redes escolhidas no quiz do mês; ausente = todas.
  redes?: readonly Rede[],
}
export type PostGerado = {
  data: string, rede: Rede,
  tipo: 'feed' | 'stories' | 'video' | 'status' | 'lista',
  formato: 'arte' | 'carrossel' | 'montagem' | 'gravar' | 'texto',
  pilar: Pilar, titulo: string, legenda: string, hashtags: string[], horario: string,
  roteiro: string | null, produto_id: string | null, ordem: number,
  // Preço guardado no post (promoção: de/por; vitrine: só por; sem preço: os dois null).
  preco_de: number | null, preco_por: number | null,
}

const MIX: Record<Estrategia, Record<Pilar, number>> = {
  vender: { demo: 0.5, aprox: 0.2, need: 0.3 },
  tempo: { demo: 0.4, aprox: 0.3, need: 0.3 },
  crescer: { demo: 0.2, aprox: 0.45, need: 0.35 },
  credibilidade: { demo: 0.25, aprox: 0.5, need: 0.25 },
}
// Quantos vídeos do mês são montagem com fotos; o resto é roteiro para gravar.
const MONTAGENS: Record<Estrategia, number> = { vender: 2, tempo: 3, crescer: 2, credibilidade: 2 }
const TEMAS_CONFIANCA = /bastidores|equipe|hist[oó]ria|cliente feliz|trajet[oó]ria/i
const ORDEM_REDE = { instagram: 0, facebook: 1, tiktok: 2, whatsapp: 3 }
const ORDEM_TIPO = { feed: 0, stories: 1, video: 2, status: 3, lista: 4 }

const unq = (s: string) => s.replace(/^"|"$/g, '')
const limitar = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
const paragrafos = (...p: (string | null | undefined | false)[]) => p.filter(Boolean).join('\n\n')
// Igual ao selo da arte (situacao.js `dinheiro`): sem ",00" quando inteiro, duas casas quando fracionado.
const brl = (v: number) => {
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

// Como o preço do item aparece nos posts. Produto antigo sem preco_promo, com preço, é vitrine.
export function tratamentoDoItem(pr: Pick<Produto, 'preco' | 'preco_promo'>, ramo: Ramo): Tratamento | null {
  if (ramo.noPromo || !pr.preco) return null
  return pr.preco_promo != null && pr.preco_promo < pr.preco ? 'promo' : 'vitrine'
}

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

// O parágrafo e os campos de preço de um item com tratamento.
function precoDoItem({ pr, trat }: ItemComPreco) {
  const preco = pr.preco!
  return trat === 'promo'
    ? { texto: `De ${brl(preco)} por ${brl(pr.preco_promo!)}. Aproveite enquanto durar!`, preco_de: preco, preco_por: pr.preco_promo! }
    : { texto: `Por ${brl(preco)}.`, preco_de: null, preco_por: preco }
}

// Partes de um post de feed antes de escolher o convite (o convite só é sorteado quando o post é aceito).
type Partes = {
  pilar: Pilar, titulo: string, formato: 'arte' | 'carrossel', gancho: string, meio: string,
  roteiro: string, produto_id: string | null, descricao: string | null, conviteProprio: string | null,
  preco: string, preco_de: number | null, preco_por: number | null,
}
const SEM_PRECO = { preco: '', preco_de: null, preco_por: null }

export function gerarMes(p: Pacote): PostGerado[] {
  const ramo = RAMOS[p.ramo]
  if (!ramo) throw new Error(`ramo desconhecido: ${p.ramo}`)
  if (!p.produtos.length) throw new Error('sem produtos')

  const agenda = agendaDoMes(p.anoMes, p.inicio, p.estrategia)
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
  const aproxStories = girar(ramo.aprox.filter((a) => a.fmt === 'Stories'), desl)
  const aproxGravar = girar([...ramo.aprox.filter((a) => a.fmt === 'Reels'),
    ...ramo.aprox.filter((a) => a.fmt === 'Post' || a.fmt === 'Carrossel')], desl)

  const out: Omit<PostGerado, 'ordem' | 'horario'>[] = []

  // ---- Feed (Instagram + Facebook) e Stories, nos mesmos dias ----
  const usados: Record<Pilar, number> = { demo: 0, aprox: 0, need: 0 }
  const idx: Record<Pilar, number> = { demo: 0, aprox: 0, need: 0 }
  let anterior: Pilar | null = null, tituloAnterior = ''

  const demo = ({ pr, it }: ItemDoMes, titulo: string, preco: Pick<Partes, 'preco' | 'preco_de' | 'preco_por'>): Partes => ({
    pilar: 'demo', titulo: limitar(titulo), formato: 'arte',
    gancho: unq(it.gancho), meio: unq(it.beneficio), roteiro: `Como montar: ${it.demo}`,
    produto_id: pr.id, descricao: pr.descricao, conviteProprio: null, ...preco,
  })
  const montar = (pilar: Pilar): Partes => {
    if (pilar === 'demo') return demo(itens[idx.demo % L], ramo.titulo(itens[idx.demo % L].it), SEM_PRECO)
    if (pilar === 'need') {
      const { pr, it } = itens[(idx.need + 1) % L]
      return {
        pilar, titulo: limitar(it.dor), formato: idx.need % 2 ? 'carrossel' : 'arte',
        gancho: unq(it.dorG), meio: unq(it.dorT), roteiro: `Como montar: ${it.sol}`,
        produto_id: pr.id, descricao: pr.descricao, conviteProprio: null, ...SEM_PRECO,
      }
    }
    const a = aproxFeed[idx.aprox % aproxFeed.length], { it } = itens[idx.aprox % L]
    return {
      pilar, titulo: limitar(trocar(a.t, it)), formato: a.fmt === 'Carrossel' ? 'carrossel' : 'arte',
      gancho: campo(a, 0, it), meio: campo(a, 2, it), roteiro: `Como montar: ${campo(a, 1, it)}`,
      produto_id: null, descricao: null, conviteProprio: campo(a, 3, it), ...SEM_PRECO,
    }
  }

  // Dia de preço: post de demonstração do item, com o preço (vale para o Instagram e o Facebook do dia).
  const precoDoDia = diasDePreco(agenda.feed, itens, p.estrategia, ramo)
  const montarPreco = (x: ItemComPreco): Partes => {
    const { texto, ...campos } = precoDoItem(x)
    const titulo = x.trat === 'promo' ? 'Oferta: ' + ramo.titulo(x.it) : ramo.titulo(x.it)
    return demo(x, titulo, { preco: texto, ...campos })
  }

  agenda.feed.forEach((data, i) => {
    const mix = MIX[p.estrategia]
    const ordem = (['demo', 'aprox', 'need'] as Pilar[])
      .map((k) => ({ k, s: mix[k] * (i + 1) - usados[k] - (k === anterior ? 0.6 : 0) }))
      .sort((x, y) => y.s - x.s).map((x) => x.k)
    const doDia = precoDoDia.get(data)
    // evita o mesmo título em dois dias seguidos (ex.: um item só)
    const partes = doDia ? montarPreco(doDia)
      : ordem.map((k) => montar(k)).find((x) => x.titulo !== tituloAnterior) ?? montar(ordem[0])
    // o dia de preço conta como demo, mas não anda a fila dos demos sem preço
    usados[partes.pilar]++
    if (!doDia) idx[partes.pilar]++
    anterior = partes.pilar; tituloAnterior = partes.titulo

    const conv = crescer || !partes.conviteProprio ? convite() : partes.conviteProprio
    const base = {
      data, formato: partes.formato, pilar: partes.pilar, titulo: partes.titulo, produto_id: partes.produto_id,
      roteiro: partes.roteiro, preco_de: partes.preco_de, preco_por: partes.preco_por,
    }
    out.push({ ...base, rede: 'instagram', tipo: 'feed', hashtags: tagsIG(partes.pilar),
      legenda: paragrafos(partes.gancho, partes.meio, partes.preco, conv, siga) })
    out.push({ ...base, rede: 'facebook', tipo: 'feed', hashtags: tagsFB,
      legenda: paragrafos(partes.gancho, partes.meio, partes.descricao, partes.preco, conv, siga,
        `${nome}${insta ? ` · Instagram ${insta}` : ''}`) })

    const s = aproxStories[i % aproxStories.length], { it } = itens[i % L]
    const enquete = s.poll?.length
      ? (s.poll.length === 1 ? `Caixinha: ${s.poll[0]}` : `Enquete: ${s.poll.join(' / ')}`)
      : campo(s, 3, it)
    out.push({ data, rede: 'instagram', tipo: 'stories', formato: 'arte', pilar: 'aprox',
      titulo: limitar(trocar(s.t, it)), legenda: paragrafos(campo(s, 0, it), enquete),
      hashtags: [], roteiro: `Como montar: ${campo(s, 1, it)}`, produto_id: null, preco_de: null, preco_por: null })
  })

  // ---- Vídeos (TikTok / Reels): primeiro as montagens com fotos, depois os roteiros para gravar ----
  agenda.videos.forEach((data, i) => {
    const conv = convite()
    if (i < MONTAGENS[p.estrategia]) {
      const { pr, it } = itens[i % L]
      const gancho = unq(it.gancho)
      out.push({ data, rede: 'tiktok', tipo: 'video', formato: 'montagem', pilar: 'demo',
        titulo: limitar(ramo.titulo(it)), legenda: paragrafos(gancho, conv), hashtags: tagsIG('demo'),
        roteiro: [`1. Abertura (texto na tela): ${gancho}`, `2. Fotos de ${pr.nome}: ${it.demo}`, `3. Fechamento: ${conv}`].join('\n'),
        produto_id: pr.id, preco_de: null, preco_por: null })
    } else {
      const j = i - MONTAGENS[p.estrategia]
      const a = aproxGravar[j % aproxGravar.length], { it } = itens[j % L]
      out.push({ data, rede: 'tiktok', tipo: 'video', formato: 'gravar', pilar: 'aprox',
        titulo: limitar(trocar(a.t, it)), legenda: paragrafos(campo(a, 0, it), conv), hashtags: tagsIG('aprox'),
        roteiro: a.f.map(([k], n) => `${n + 1}. ${k}: ${campo(a, n, it)}`).join('\n'), produto_id: null,
        preco_de: null, preco_por: null })
    }
  })

  // ---- WhatsApp: Status (alterna problema e demonstração) e mensagens para a lista ----
  agenda.status.forEach((data, i) => {
    const { pr, it } = itens[Math.floor(i / 2) % L]
    const need = i % 2 === 0
    out.push({ data, rede: 'whatsapp', tipo: 'status', formato: 'texto', pilar: need ? 'need' : 'demo',
      titulo: limitar(need ? it.dor : ramo.titulo(it)),
      legenda: paragrafos(unq(need ? it.dorG : it.gancho), convite()),
      hashtags: [], roteiro: null, produto_id: pr.id, preco_de: null, preco_por: null })
  })
  // A lista mostra o preço do item só em "Vender mais" (spec §9b).
  agenda.lista.forEach((data, i) => {
    const { pr, it } = itens[i % L]
    const trat = p.estrategia === 'vender' ? tratamentoDoItem(pr, ramo) : null
    const { texto, ...campos } = trat ? precoDoItem({ pr, it, trat }) : { texto: '', preco_de: null, preco_por: null }
    out.push({ data, rede: 'whatsapp', tipo: 'lista', formato: 'texto', pilar: 'demo',
      titulo: limitar(`Mensagem para a lista: ${pr.nome}`),
      legenda: paragrafos(`Oi! Aqui é ${nome}.`, unq(it.beneficio), texto, convite()),
      hashtags: [], roteiro: null, produto_id: pr.id, ...campos })
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
