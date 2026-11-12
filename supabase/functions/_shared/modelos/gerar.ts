// Monta o mês inteiro com os modelos prontos (sem IA). Determinística: o mesmo pacote dá o mesmo mês.
// Baseada na geração do PAT atual (bancada/index.html, generate/buildDemo/buildNeed/buildAprox/caption).
import type { Aprox, Estrategia, Item, Pilar, Rede, Tom } from './tipos.ts'
import { ENGAJA_CTA, RAMOS, itemDoProduto } from './ramos/index.ts'
import { agendaDoMes } from './calendario.ts'

export type Pacote = {
  ramo: string, estrategia: Estrategia, anoMes: string, inicio: string,
  negocio: { nome: string, insta: string | null, tom: Tom, horario: string },
  produtos: { id: string, nome: string, descricao: string | null, preco: number | null }[],
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
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ')
const ehSexta = (data: string) => new Date(`${data}T00:00:00Z`).getUTCDay() === 5

const girar = <T>(lista: readonly T[], n: number): T[] => {
  const k = lista.length ? n % lista.length : 0
  return [...lista.slice(k), ...lista.slice(0, k)]
}

function tagLoja(nome: string) {
  const t = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return '#' + (t || 'meunegocio')
}

// Partes de um post de feed antes de escolher o convite (o convite só é sorteado quando o post é aceito).
type Partes = {
  pilar: Pilar, titulo: string, formato: 'arte' | 'carrossel', gancho: string, meio: string,
  roteiro: string, produto_id: string | null, descricao: string | null, oferta: string, conviteProprio: string | null,
}

export function gerarMes(p: Pacote): PostGerado[] {
  const ramo = RAMOS[p.ramo]
  if (!ramo) throw new Error(`ramo desconhecido: ${p.ramo}`)
  if (!p.produtos.length) throw new Error('sem produtos')

  const agenda = agendaDoMes(p.anoMes, p.inicio, p.estrategia)
  const desl = p.deslocamento ?? 0
  const itens = girar(p.produtos, desl).map((pr) => ({ pr, it: itemDoProduto(ramo, pr.nome) }))
  const L = itens.length
  const nome = p.negocio.nome
  const insta = p.negocio.insta ? (p.negocio.insta.startsWith('@') ? p.negocio.insta : `@${p.negocio.insta}`) : null
  const crescer = p.estrategia === 'crescer'
  const comOferta = p.estrategia === 'vender' && !ramo.noPromo

  let cta = 0
  const engaja = girar(ENGAJA_CTA, desl)
  const convite = () => unq(crescer ? engaja[cta++ % engaja.length] : ramo.convite[p.negocio.tom])
  const nomeItem = (it: Item) => (it.art ? `${it.art} ${it.curto}` : it.curto)
  const trocar = (s: string, it: Item) => s.replaceAll('{prod}', nomeItem(it)).replaceAll('{loja}', nome)
  const campo = (a: Aprox, i: number, it: Item) => unq(trocar(a.f[i]?.[1] ?? '', it))
  const tagsIG = (pilar: Pilar) => [...ramo.tags, ramo.ptags[pilar], tagLoja(nome)]
  const tagsFB = [tagLoja(nome), ramo.tags[0]]
  const oferta = (preco: number | null) =>
    preco ? `Condição especial esta semana: a partir de ${brl(preco)}.` : 'Condição especial esta semana.'
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

  const montar = (pilar: Pilar, sexta: boolean): Partes => {
    if (pilar === 'demo') {
      const { pr, it } = itens[idx.demo % L]
      const promo = comOferta && sexta
      return {
        pilar, titulo: limitar((promo ? 'Oferta da semana: ' : '') + ramo.titulo(it)), formato: 'arte',
        gancho: unq(it.gancho), meio: unq(it.beneficio), roteiro: `Como montar: ${it.demo}`,
        produto_id: pr.id, descricao: pr.descricao, oferta: promo ? oferta(pr.preco) : '', conviteProprio: null,
      }
    }
    if (pilar === 'need') {
      const { pr, it } = itens[(idx.need + 1) % L]
      return {
        pilar, titulo: limitar(it.dor), formato: idx.need % 2 ? 'carrossel' : 'arte',
        gancho: unq(it.dorG), meio: unq(it.dorT), roteiro: `Como montar: ${it.sol}`,
        produto_id: pr.id, descricao: pr.descricao, oferta: '', conviteProprio: null,
      }
    }
    const a = aproxFeed[idx.aprox % aproxFeed.length], { it } = itens[idx.aprox % L]
    return {
      pilar, titulo: limitar(trocar(a.t, it)), formato: a.fmt === 'Carrossel' ? 'carrossel' : 'arte',
      gancho: campo(a, 0, it), meio: campo(a, 2, it), roteiro: `Como montar: ${campo(a, 1, it)}`,
      produto_id: null, descricao: null, oferta: '', conviteProprio: campo(a, 3, it),
    }
  }

  agenda.feed.forEach((data, i) => {
    const sexta = ehSexta(data)
    const mix = MIX[p.estrategia]
    const ordem = (['demo', 'aprox', 'need'] as Pilar[])
      .map((k) => ({ k, s: mix[k] * (i + 1) - usados[k] - (k === anterior ? 0.6 : 0) }))
      .sort((x, y) => y.s - x.s).map((x) => x.k)
    if (comOferta && sexta) ordem.unshift('demo')
    // evita o mesmo título em dois dias seguidos (ex.: um item só)
    const partes = ordem.map((k) => montar(k, sexta)).find((x) => x.titulo !== tituloAnterior) ?? montar(ordem[0], sexta)
    usados[partes.pilar]++; idx[partes.pilar]++
    anterior = partes.pilar; tituloAnterior = partes.titulo

    const conv = crescer || !partes.conviteProprio ? convite() : partes.conviteProprio
    const base = { data, formato: partes.formato, pilar: partes.pilar, titulo: partes.titulo, produto_id: partes.produto_id, roteiro: partes.roteiro }
    out.push({ ...base, rede: 'instagram', tipo: 'feed', hashtags: tagsIG(partes.pilar),
      legenda: paragrafos(partes.gancho, partes.meio, partes.oferta, conv, siga) })
    out.push({ ...base, rede: 'facebook', tipo: 'feed', hashtags: tagsFB,
      legenda: paragrafos(partes.gancho, partes.meio, partes.descricao, partes.oferta, conv, siga,
        `${nome}${insta ? ` · Instagram ${insta}` : ''}`) })

    const s = aproxStories[i % aproxStories.length], { it } = itens[i % L]
    const enquete = s.poll?.length
      ? (s.poll.length === 1 ? `Caixinha: ${s.poll[0]}` : `Enquete: ${s.poll.join(' / ')}`)
      : campo(s, 3, it)
    out.push({ data, rede: 'instagram', tipo: 'stories', formato: 'arte', pilar: 'aprox',
      titulo: limitar(trocar(s.t, it)), legenda: paragrafos(campo(s, 0, it), enquete),
      hashtags: [], roteiro: `Como montar: ${campo(s, 1, it)}`, produto_id: null })
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
        produto_id: pr.id })
    } else {
      const j = i - MONTAGENS[p.estrategia]
      const a = aproxGravar[j % aproxGravar.length], { it } = itens[j % L]
      out.push({ data, rede: 'tiktok', tipo: 'video', formato: 'gravar', pilar: 'aprox',
        titulo: limitar(trocar(a.t, it)), legenda: paragrafos(campo(a, 0, it), conv), hashtags: tagsIG('aprox'),
        roteiro: a.f.map(([k], n) => `${n + 1}. ${k}: ${campo(a, n, it)}`).join('\n'), produto_id: null })
    }
  })

  // ---- WhatsApp: Status (alterna problema e demonstração) e mensagens para a lista ----
  agenda.status.forEach((data, i) => {
    const { pr, it } = itens[Math.floor(i / 2) % L]
    const need = i % 2 === 0
    out.push({ data, rede: 'whatsapp', tipo: 'status', formato: 'texto', pilar: need ? 'need' : 'demo',
      titulo: limitar(need ? it.dor : ramo.titulo(it)),
      legenda: paragrafos(unq(need ? it.dorG : it.gancho), convite()),
      hashtags: [], roteiro: null, produto_id: pr.id })
  })
  agenda.lista.forEach((data, i) => {
    const { pr, it } = itens[i % L]
    out.push({ data, rede: 'whatsapp', tipo: 'lista', formato: 'texto', pilar: 'demo',
      titulo: limitar(`Mensagem para a lista: ${pr.nome}`),
      legenda: paragrafos(`Oi! Aqui é ${nome}.`, unq(it.beneficio), comOferta && oferta(pr.preco), convite()),
      hashtags: [], roteiro: null, produto_id: pr.id })
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
