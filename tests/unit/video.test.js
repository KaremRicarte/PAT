import { escolherFormato, validarDuracao, planoDoVideo, podeEditarVideo, momentoDaMontagem, enquadramento, codigoDoErro } from '../../app/src/artes/video.js'

test('escolherFormato: tenta MP4 primeiro e cai para WebM', () => {
  expect(escolherFormato((m) => m === 'video/webm')).toEqual({ mime: 'video/webm', ext: 'webm' })
  expect(escolherFormato((m) => m.startsWith('video/mp4'))).toEqual({ mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' })
  expect(escolherFormato((m) => m === 'video/mp4')).toEqual({ mime: 'video/mp4', ext: 'mp4' })
  expect(escolherFormato((m) => m.startsWith('video/webm;codecs=vp'))).toEqual({ mime: 'video/webm;codecs=vp9', ext: 'webm' })
  expect(escolherFormato(() => false)).toBeNull()
})

test('validarDuracao: até 60 s, sem duração inválida', () => {
  expect(validarDuracao(59.9)).toBe('ok')
  expect(validarDuracao(60)).toBe('ok')
  expect(validarDuracao(60.5)).toBe('longo')
  expect(validarDuracao(NaN)).toBe('invalido')
  expect(validarDuracao(Infinity)).toBe('invalido')
  expect(validarDuracao(0)).toBe('invalido')
  expect(validarDuracao(-3)).toBe('invalido')
})

test('planoDoVideo: título nos 3 primeiros segundos e 2 s de tela final', () => {
  expect(planoDoVideo(10)).toEqual({ total: 12, tituloAte: 3, fimDe: 10, fimAte: 12 })
  expect(planoDoVideo(45.5)).toEqual({ total: 47.5, tituloAte: 3, fimDe: 45.5, fimAte: 47.5 })
})

test('podeEditarVideo: precisa de MediaRecorder e de captureStream no canvas', () => {
  expect(podeEditarVideo()).toBe(false) // node: nenhum dos dois
  vi.stubGlobal('MediaRecorder', class {})
  vi.stubGlobal('HTMLCanvasElement', class {})
  expect(podeEditarVideo()).toBe(false)
  HTMLCanvasElement.prototype.captureStream = () => null
  expect(podeEditarVideo()).toBe(true)
  vi.unstubAllGlobals()
})

test('momentoDaMontagem: 4 partes de 3 s, com as fotos repartidas nos 9 s antes da tela final', () => {
  expect(momentoDaMontagem(0, 2)).toMatchObject({ parte: 0, foto: 0, progresso: 0 })
  expect(momentoDaMontagem(3.5, 2)).toMatchObject({ parte: 1, foto: 0 })
  expect(momentoDaMontagem(4.6, 2)).toMatchObject({ parte: 1, foto: 1 })
  expect(momentoDaMontagem(7, 2)).toMatchObject({ parte: 2, foto: 1 })
  expect(momentoDaMontagem(11.5, 2)).toMatchObject({ parte: 3, foto: 1 })
  expect(momentoDaMontagem(12, 2).progresso).toBe(1)
  expect(momentoDaMontagem(5, 0).foto).toBe(-1) // sem fotos
  expect(momentoDaMontagem(5, 1).foto).toBe(0)
  // entra e sai em fade: 0 no início da parte, 1 no meio, perto de 0 no fim
  expect(momentoDaMontagem(3, 1).alfa).toBe(0)
  expect(momentoDaMontagem(4.5, 1).alfa).toBe(1)
  expect(momentoDaMontagem(5.99, 1).alfa).toBeLessThan(0.1)
  expect(momentoDaMontagem(11.99, 1).alfa).toBe(1) // a tela final não some
  // zoom da foto vai de 0 a 1 dentro do trecho dela
  expect(momentoDaMontagem(0, 2).zoom).toBe(0)
  expect(momentoDaMontagem(4.49, 2).zoom).toBeGreaterThan(0.99)
  expect(momentoDaMontagem(4.5, 2).zoom).toBe(0)
})

test("enquadramento: vídeo vertical cobre a tela; horizontal ou quadrado fica inteiro, centralizado", () => {
  expect(enquadramento(1080, 1920, 720, 1280)).toEqual({ x: 0, y: 0, w: 720, h: 1280 })
  expect(enquadramento(1920, 1080, 720, 1280)).toEqual({ x: 0, y: 437.5, w: 720, h: 405 })
  expect(enquadramento(1000, 1000, 720, 1280)).toEqual({ x: 0, y: 280, w: 720, h: 720 })
  // vertical mais alto que 9:16: corta em cima e embaixo
  expect(enquadramento(1000, 2000, 720, 1280)).toEqual({ x: 0, y: -80, w: 720, h: 1440 })
  // vertical mais largo que 9:16: corta dos lados
  expect(enquadramento(900, 1200, 720, 1280)).toEqual({ x: -120, y: 0, w: 960, h: 1280 })
  expect(enquadramento(0, 0, 720, 1280)).toBeNull() // ainda sem quadro
})

test("codigoDoErro: mantém o código; autoplay recusado vira sem-permissao; o resto vira falhou", () => {
  expect(codigoDoErro(Object.assign(new Error("x"), { codigo: "longo" }))).toBe("longo")
  expect(codigoDoErro(Object.assign(new Error("x"), { name: "NotAllowedError" }))).toBe("sem-permissao")
  expect(codigoDoErro(new Error("qualquer"))).toBe("falhou")
  expect(codigoDoErro(undefined)).toBe("falhou")
})

// ---------- tela acesa durante a gravação ----------
test('manterTelaAcesa: pede a trava de tela; sem wakeLock ou com recusa devolve null', async () => {
  const { manterTelaAcesa } = await import('../../app/src/artes/video.js')
  const trava = { release: vi.fn() }
  const request = vi.fn(async () => trava)
  expect(await manterTelaAcesa({ wakeLock: { request } })).toBe(trava)
  expect(request).toHaveBeenCalledWith('screen')
  expect(await manterTelaAcesa({})).toBe(null)
  expect(await manterTelaAcesa(undefined)).toBe(null)
  expect(await manterTelaAcesa({ wakeLock: { request: async () => { throw new Error('NotAllowedError') } } })).toBe(null)
  expect(await manterTelaAcesa({ wakeLock: { request: () => { throw new Error('síncrono') } } })).toBe(null)
})

test('soltarTela: libera a trava sem quebrar quando ela já foi solta ou não existe', async () => {
  const { soltarTela } = await import('../../app/src/artes/video.js')
  const trava = { release: vi.fn(async () => {}) }
  soltarTela(trava)
  expect(trava.release).toHaveBeenCalledTimes(1)
  expect(() => soltarTela(null)).not.toThrow()
  expect(() => soltarTela({ release: () => Promise.reject(new Error('já solta')) })).not.toThrow()
  expect(() => soltarTela({ release: () => { throw new Error('já solta') } })).not.toThrow()
})

// ---------- <video> criado no toque (iPhone) ----------
function documentoFalso() {
  const anexados = []
  const novoVideo = () => ({
    style: {}, atributos: {}, muted: true, playsInline: false, chamadas: [],
    setAttribute(k, val) { this.atributos[k] = val },
    load() { this.chamadas.push('load') },
    pause() { this.chamadas.push('pause') },
    play() { this.chamadas.push('play'); return Promise.reject(Object.assign(new Error('sem src'), { name: 'NotSupportedError' })) },
    remove() { anexados.splice(anexados.indexOf(this), 1) },
  })
  return { anexados, document: { createElement: (tag) => (tag === 'video' ? novoVideo() : null), body: { append: (n) => anexados.push(n) } } }
}

test('criarVideoDoGesto: <video> com som, playsinline, na página e invisível, já com play() no toque', async () => {
  const { criarVideoDoGesto } = await import('../../app/src/artes/video.js')
  const { document, anexados } = documentoFalso()
  vi.stubGlobal('document', document)
  try {
    const video = criarVideoDoGesto()
    expect(anexados).toEqual([video])
    expect(video.muted).toBe(false)
    expect(video.playsInline).toBe(true)
    expect(video.atributos.playsinline).toBe('')
    expect(video.atributos['aria-hidden']).toBe('true')
    expect(video.style).toMatchObject({ position: 'fixed', width: '1px', height: '1px', opacity: '0.01', pointerEvents: 'none' })
    expect(video.chamadas.slice(-2)).toEqual(['play', 'pause']) // destrava no toque e não deixa tocar sozinho; a recusa sem src não escapa
    await Promise.resolve()
  } finally {
    vi.unstubAllGlobals()
  }
})
