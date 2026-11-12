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
