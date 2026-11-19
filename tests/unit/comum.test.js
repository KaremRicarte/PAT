import { vi } from 'vitest'
import { filhosValidos, invocar } from '../../app/src/comum.js'

describe('filhosValidos', () => {
  it('achata listas e descarta vazios (null, undefined, false)', () => {
    const a = { n: 'a' }, b = { n: 'b' }, c = { n: 'c' }
    expect(filhosValidos([a, null, [b, [c, undefined]], false])).toEqual([a, b, c])
  })

  it('mantém textos e o zero', () => {
    expect(filhosValidos(['oi', 0, ''])).toEqual(['oi', 0, ''])
  })
})

describe('invocar (funções do servidor com login renovado)', () => {
  const resp = (status) => ({ data: status ? null : { ok: true }, error: status ? { context: { status } } : null })
  const falso = (respostas, renovar = { error: null }) => {
    const invoke = vi.fn(async () => respostas.shift())
    return { functions: { invoke }, auth: { refreshSession: vi.fn(async () => renovar), signOut: vi.fn(async () => ({})) } }
  }
  test('sem erro de login: chama uma vez só', async () => {
    const sb = falso([resp(0)])
    expect((await invocar(sb, 'refazer-posts', { body: {} })).data).toEqual({ ok: true })
    expect(sb.functions.invoke).toHaveBeenCalledTimes(1)
    expect(sb.auth.refreshSession).not.toHaveBeenCalled()
  })
  test('401: renova o login e tenta de novo', async () => {
    const sb = falso([resp(401), resp(0)])
    expect((await invocar(sb, 'refazer-posts', { body: {} })).data).toEqual({ ok: true })
    expect(sb.functions.invoke).toHaveBeenCalledTimes(2)
    expect(sb.auth.signOut).not.toHaveBeenCalled()
  })
  test('sessão encerrada (não renova): sai só deste aparelho, e o app volta para a tela de entrar', async () => {
    const sb = falso([resp(401)], { error: new Error('refresh token revogado') })
    expect((await invocar(sb, 'refazer-posts', {})).error.context.status).toBe(401)
    expect(sb.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
