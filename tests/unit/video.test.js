import { escolherFormato, validarDuracao, planoDoVideo, podeEditarVideo, momentoDaMontagem } from '../../app/src/artes/video.js'

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
