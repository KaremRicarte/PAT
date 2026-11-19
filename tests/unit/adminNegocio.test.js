import { validarNegocio, linhaNovaDoNegocio, caminhoDoLogo } from '../../app/src/admin/negocio.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

test('validarNegocio: nome obrigatório (2 a 80) e @ opcional normalizado', () => {
  expect(validarNegocio({ nome: '  Malibu Turismo ', insta: 'malibu.turismo' })).toEqual({ dados: { nome: 'Malibu Turismo', insta: '@malibu.turismo' } })
  expect(validarNegocio({ nome: 'Ab', insta: '' })).toEqual({ dados: { nome: 'Ab', insta: null } })
  expect(validarNegocio({ nome: ' A ', insta: '' })).toEqual({ erro: 'admin.negocio.semnome' })
  expect(validarNegocio({ nome: 'x'.repeat(81), insta: '' })).toEqual({ erro: 'admin.negocio.semnome' })
  expect(validarNegocio({ nome: 'Malibu', insta: '@com espaço' })).toEqual({ erro: 'quiz.insta.erro' })
})

test('linhaNovaDoNegocio: cores do ramo e questionário ainda não respondido (pronto fica no padrão do banco)', () => {
  const linha = linhaNovaDoNegocio({ id: 'c1', ramo: 'turismo' }, { nome: 'Malibu', insta: null }, 'c1/marca/logo-1.png')
  expect(linha).toEqual({ cliente_id: 'c1', nome: 'Malibu', insta: null, logo_path: 'c1/marca/logo-1.png', ...RAMOS.turismo.cores })
  expect(linha).not.toHaveProperty('pronto')
})

test('caminhoDoLogo fica na pasta marca/ do cliente (onde o cliente não grava)', () => {
  expect(caminhoDoLogo('c1', 123)).toBe('c1/marca/logo-123.png')
})
