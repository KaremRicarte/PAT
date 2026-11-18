import { describe, it, expect } from 'vitest'
import { corpoFal, lerRespostaFal, hostPermitido, SUFIXO_PROMPT } from '../../supabase/functions/_shared/ia/fal.ts'

describe('corpoFal', () => {
  it('feed: 864x1080 com o sufixo de segurança', () => {
    expect(corpoFal('a set table', 'feed')).toEqual({
      prompt: 'a set table, ' + SUFIXO_PROMPT,
      image_size: { width: 864, height: 1080 },
      num_images: 1, enable_safety_checker: true, output_format: 'jpeg',
    })
  })
  it('vertical: portrait_16_9', () => {
    expect(corpoFal('x', 'vertical').image_size).toBe('portrait_16_9')
  })
})

describe('lerRespostaFal', () => {
  it('lê a primeira imagem', () => {
    expect(lerRespostaFal({ images: [{ url: 'https://v3b.fal.media/f.jpg', width: 864, height: 1080 }], has_nsfw_concepts: [false] }))
      .toEqual({ url: 'https://v3b.fal.media/f.jpg', largura: 864, altura: 1080, bloqueada: false })
  })
  it('nsfw vira bloqueada', () => {
    expect(lerRespostaFal({ images: [{ url: 'https://v3b.fal.media/f.jpg', width: 1, height: 2 }], has_nsfw_concepts: [true] })?.bloqueada).toBe(true)
  })
  it('respostas inválidas viram null', () => {
    expect(lerRespostaFal({})).toBeNull()
    expect(lerRespostaFal(null)).toBeNull()
    expect(lerRespostaFal({ images: [] })).toBeNull()
    expect(lerRespostaFal({ images: [{ url: 'http://v3b.fal.media/f.jpg' }] })).toBeNull()
    expect(lerRespostaFal({ images: [{ url: 'não é url' }] })).toBeNull()
  })
})

describe('hostPermitido', () => {
  it('aceita Pexels, Pixabay e fal.media', () => {
    for (const h of ['images.pexels.com', 'pixabay.com', 'cdn.pixabay.com', 'v3b.fal.media', 'fal.media']) expect(hostPermitido(h)).toBe(true)
  })
  it('recusa imitações', () => {
    for (const h of ['evilfal.media', 'fal.media.evil.com', 'evil.com', '']) expect(hostPermitido(h)).toBe(false)
  })
})
