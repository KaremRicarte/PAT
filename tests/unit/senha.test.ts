import { gerarSenha } from '../../supabase/functions/_shared/senha.ts'

test('10 caracteres sem ambíguos', () => {
  for (let i = 0; i < 200; i++) expect(gerarSenha()).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{10}$/)
})
