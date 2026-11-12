// Regras que todo post precisa cumprir, venha dos modelos prontos ou da IA (Etapa 3).
import { REDES, type Ramo, type Rede } from './tipos.ts'
import type { Agenda } from './calendario.ts'
import type { PostGerado } from './gerar.ts'

// Preço ou promoção, como palavra inteira: "promoção" e "50% off" contam; "promover" e "100% online" não.
const PROIBIDAS = /R\$|(?<!\p{L})(promo(ção|ções|cional|cionais|s)?|descontos?|ofertas?|off)(?!\p{L})|black friday/iu
export const temPromocao = (s: string) => PROIBIDAS.test(s)
const SOBRAS = /undefined|\{prod\}|\{loja\}/
const MAX_HASHTAGS: Record<PostGerado['rede'], number> = { instagram: 5, tiktok: 5, facebook: 3, whatsapp: 0 }

export function validarPost(post: PostGerado, ramo: Ramo): string[] {
  const erros: string[] = []
  const titulo = post.titulo.trim(), legenda = post.legenda.trim()
  if (!titulo || titulo.length > 90) erros.push('título vazio ou com mais de 90 caracteres')
  if (!legenda || legenda.length > 2200) erros.push('legenda vazia ou com mais de 2200 caracteres')
  if (post.hashtags.length > MAX_HASHTAGS[post.rede]) erros.push(`hashtags demais para ${post.rede}`)
  const textos = [post.titulo, post.legenda, post.roteiro ?? '', ...post.hashtags]
  if (textos.some((t) => SOBRAS.test(t))) erros.push('marcador sobrando no texto')
  if (ramo.noPromo && textos.some(temPromocao)) erros.push('preço ou promoção num ramo que não permite')
  return erros
}

// `redes`: as escolhidas no quiz do mês (ausente = todas); das outras, espera zero posts.
export function validarMes(posts: PostGerado[], agenda: Agenda, redes: readonly Rede[] = REDES): string[] {
  const todos: Record<string, number> = {
    'instagram/feed': agenda.feed.length, 'instagram/stories': agenda.feed.length, 'facebook/feed': agenda.feed.length,
    'tiktok/video': agenda.videos.length, 'whatsapp/status': agenda.status.length, 'whatsapp/lista': agenda.lista.length,
  }
  const esperado = Object.fromEntries(Object.entries(todos).filter(([k]) => redes.includes(k.split('/')[0] as Rede)))
  const contado: Record<string, number> = {}
  for (const p of posts) contado[`${p.rede}/${p.tipo}`] = (contado[`${p.rede}/${p.tipo}`] ?? 0) + 1
  const chaves = new Set([...Object.keys(esperado), ...Object.keys(contado)])
  return [...chaves]
    .filter((k) => (esperado[k] ?? 0) !== (contado[k] ?? 0))
    .map((k) => `${k}: esperado ${esperado[k] ?? 0}, veio ${contado[k] ?? 0}`)
}
