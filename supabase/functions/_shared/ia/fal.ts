// Lógica pura do fal.ai (FLUX schnell) e da lista de servidores de imagem permitidos.
// Sem `npm:` nem rede: o Vitest importa este arquivo. O fetch fica em adaptadores.ts.

export const SUFIXO_PROMPT = 'realistic professional photograph, natural light, no people, no faces, no text, no letters, no logos, no watermark'

export type FormatoImagem = 'feed' | 'vertical'

// Corpo do pedido ao fal.ai: feed 4:5 (864x1080) e vertical 9:16 (stories/reels).
export function corpoFal(prompt: string, formato: FormatoImagem) {
  return {
    prompt: `${prompt}, ${SUFIXO_PROMPT}`,
    image_size: formato === 'feed' ? { width: 864, height: 1080 } : 'portrait_16_9',
    num_images: 1,
    enable_safety_checker: true,
    output_format: 'jpeg',
  }
}

// Lê a resposta do fal.ai. null se não veio uma imagem com URL https.
export function lerRespostaFal(json: unknown): { url: string, largura: number, altura: number, bloqueada: boolean } | null {
  if (!json || typeof json !== 'object') return null
  const r = json as { images?: unknown, has_nsfw_concepts?: unknown }
  if (!Array.isArray(r.images)) return null
  const img = r.images[0] as { url?: unknown, width?: unknown, height?: unknown } | undefined
  if (!img || typeof img.url !== 'string') return null
  try {
    if (new URL(img.url).protocol !== 'https:') return null
  } catch { return null }
  return {
    url: img.url,
    largura: Number(img.width) || 0,
    altura: Number(img.height) || 0,
    bloqueada: Array.isArray(r.has_nsfw_concepts) && r.has_nsfw_concepts[0] === true,
  }
}

// Servidores de onde aceitamos baixar imagens: Pexels, Pixabay e fal.media (e subdomínios, como v3b.fal.media).
const HOSTS_EXATOS = ['images.pexels.com', 'pixabay.com', 'cdn.pixabay.com']
const DOMINIOS = ['fal.media']

export function hostPermitido(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return HOSTS_EXATOS.includes(h) || DOMINIOS.some((d) => h === d || h.endsWith('.' + d))
}
