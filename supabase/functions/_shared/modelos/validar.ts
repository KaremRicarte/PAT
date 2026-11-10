// Regras que todo post precisa cumprir, venha dos modelos prontos ou da IA (Etapa 3).
import type { Ramo } from './tipos.ts'
import type { Agenda } from './calendario.ts'
import type { PostGerado } from './gerar.ts'

const PROIBIDAS = /R\$|\d+\s?%|promo|desconto|oferta|black friday/i
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
  if (ramo.noPromo && textos.some((t) => PROIBIDAS.test(t))) erros.push('preço ou promoção num ramo que não permite')
  return erros
}

export function validarMes(posts: PostGerado[], agenda: Agenda): string[] {
  const esperado: Record<string, number> = {
    'instagram/feed': agenda.feed.length, 'instagram/stories': agenda.feed.length, 'facebook/feed': agenda.feed.length,
    'tiktok/video': agenda.videos.length, 'whatsapp/status': agenda.status.length, 'whatsapp/lista': agenda.lista.length,
  }
  const contado: Record<string, number> = {}
  for (const p of posts) contado[`${p.rede}/${p.tipo}`] = (contado[`${p.rede}/${p.tipo}`] ?? 0) + 1
  const chaves = new Set([...Object.keys(esperado), ...Object.keys(contado)])
  return [...chaves]
    .filter((k) => (esperado[k] ?? 0) !== (contado[k] ?? 0))
    .map((k) => `${k}: esperado ${esperado[k] ?? 0}, veio ${contado[k] ?? 0}`)
}
