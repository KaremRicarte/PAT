import { vi } from 'vitest'

const { entregar } = await import('../../app/src/cliente/salvarArquivo.js')
const arquivos = [new File(['a'], 'a.png', { type: 'image/png' })]

function aparelho({ podeCompartilhar = true, share = () => Promise.resolve() } = {}) {
  return { nav: { canShare: vi.fn(() => podeCompartilhar), share: vi.fn(share) }, baixar: vi.fn(() => Promise.resolve()) }
}

test('no iPhone compartilha já no toque, sem esperar nada antes', async () => {
  const { nav, baixar } = aparelho()
  const resultado = entregar(arquivos, 'compartilhar', { nav, baixar })
  expect(nav.share).toHaveBeenCalledWith({ files: arquivos }) // chamado de forma síncrona, dentro do gesto
  expect(await resultado).toBe('compartilhado')
  expect(baixar).not.toHaveBeenCalled()
})
test('cancelar o compartilhamento não baixa nem dá erro', async () => {
  const { nav, baixar } = aparelho({ share: () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })) })
  expect(await entregar(arquivos, 'compartilhar', { nav, baixar })).toBe('cancelado')
  expect(baixar).not.toHaveBeenCalled()
})
test('outra falha no compartilhamento cai no download', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { nav, baixar } = aparelho({ share: () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })) })
  expect(await entregar(arquivos, 'compartilhar', { nav, baixar })).toBe('baixado')
  expect(baixar).toHaveBeenCalledWith(arquivos)
  console.error.mockRestore()
})
test('estes arquivos não podem ser compartilhados: baixa', async () => {
  const { nav, baixar } = aparelho({ podeCompartilhar: false })
  expect(await entregar(arquivos, 'compartilhar', { nav, baixar })).toBe('baixado')
  expect(nav.share).not.toHaveBeenCalled()
})
test('Android e computador: baixa, sem compartilhar', async () => {
  const { nav, baixar } = aparelho()
  expect(await entregar(arquivos, 'baixar', { nav, baixar })).toBe('baixado')
  expect(nav.share).not.toHaveBeenCalled()
  expect(baixar).toHaveBeenCalledWith(arquivos)
})

// ---------- Enviar para a rede social ----------
const { enviarParaRede, aparelhoEnvia } = await import('../../app/src/cliente/salvarArquivo.js')

test('enviar: abre o compartilhar já no toque, só com os arquivos', async () => {
  const { nav } = aparelho()
  const r = enviarParaRede({ arquivos, texto: 'legenda' }, nav)
  expect(nav.share).toHaveBeenCalledWith({ files: arquivos })
  expect(await r).toBe('compartilhado')
})
test('enviar: mensagem de lista vai como texto', async () => {
  const { nav } = aparelho()
  expect(await enviarParaRede({ arquivos: null, texto: 'oi' }, nav)).toBe('compartilhado')
  expect(nav.share).toHaveBeenCalledWith({ text: 'oi' })
})
test('enviar: cancelar não é erro; outra falha é', async () => {
  const cancelou = aparelho({ share: () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })) })
  expect(await enviarParaRede({ arquivos }, cancelou.nav)).toBe('cancelado')
  const falhou = aparelho({ share: () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })) })
  await expect(enviarParaRede({ arquivos }, falhou.nav)).rejects.toThrow('x')
})
test('enviar: aparelho que não compartilha', async () => {
  const { nav } = aparelho({ podeCompartilhar: false })
  expect(await enviarParaRede({ arquivos }, nav)).toBe('sem-suporte')
  expect(nav.share).not.toHaveBeenCalled()
  expect(aparelhoEnvia(nav)).toBe(false)
  expect(aparelhoEnvia(aparelho().nav)).toBe(true)
  expect(aparelhoEnvia(undefined)).toBe(false)
})
