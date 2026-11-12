import { rotuloDoDia } from '../../app/src/cliente/calendario.js'

const post = (estado, postado_em = null) => ({ data: '2026-11-04', estado, postado_em })
const POSTADO = '2026-11-04T12:00:00Z'

test('rotuloDoDia: só pendentes', () => {
  expect(rotuloDoDia('2026-11-04', [post('gerado'), post('editado')])).toBe('4 de novembro, 2 pendentes')
})

test('rotuloDoDia: misto lista cada situação', () => {
  expect(rotuloDoDia('2026-11-04', [post('gerado'), post('aprovado'), post('aprovado'), post('reprovado'), post('aprovado', POSTADO)]))
    .toBe('4 de novembro, 1 pendente, 2 aprovados, 1 descartado, 1 postado')
})

test('rotuloDoDia: tudo postado (os descartados não contam)', () => {
  expect(rotuloDoDia('2026-11-04', [post('aprovado', POSTADO), post('aprovado', POSTADO), post('reprovado')]))
    .toBe('4 de novembro, tudo postado')
})

test('rotuloDoDia: 1 post fica no singular; dia sem post', () => {
  expect(rotuloDoDia('2026-11-04', [post('gerado')])).toBe('4 de novembro, 1 pendente')
  expect(rotuloDoDia('2026-12-25', [])).toBe('25 de dezembro, sem posts')
})

// ---------- cache das miniaturas ----------
test('guardarMiniatura: guarda a promessa e não desenha de novo', async () => {
  const { guardarMiniatura } = await import('../../app/src/cliente/calendario.js')
  const cache = new Map()
  const canvas = { tela: 1 }
  const gerar = vi.fn(async () => canvas)
  expect(await guardarMiniatura(cache, 'p1|a|false', gerar)).toBe(canvas)
  expect(await guardarMiniatura(cache, 'p1|a|false', gerar)).toBe(canvas)
  expect(gerar).toHaveBeenCalledTimes(1)
  expect(cache.has('p1|a|false')).toBe(true)
})

test('guardarMiniatura: miniatura que falhou (null ou erro) sai do cache e tenta de novo na próxima', async () => {
  const { guardarMiniatura } = await import('../../app/src/cliente/calendario.js')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const cache = new Map()
  expect(await guardarMiniatura(cache, 'k', async () => null)).toBe(null)
  expect(cache.has('k')).toBe(false)
  expect(await guardarMiniatura(cache, 'k', async () => { throw new Error('ruim') })).toBe(null)
  expect(cache.has('k')).toBe(false)
  const canvas = {}
  expect(await guardarMiniatura(cache, 'k', async () => canvas)).toBe(canvas)
  expect(cache.has('k')).toBe(true)
})
