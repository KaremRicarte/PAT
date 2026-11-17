import { linhasDoResumo } from '../../app/src/cliente/meuNegocio.js'
import { estadoDoNegocio } from '../../app/src/cliente/perguntas.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

test('linhasDoResumo: uma linha por pergunta fixa, sem redes', () => {
  const ramo = RAMOS.beleza
  const linhas = linhasDoResumo(estadoDoNegocio({ nome: 'Studio Ana', insta: '@ana', horario: '19:00' }, [], ramo), ramo)
  expect(linhas.map((l) => l.chave)).toEqual(['nome', 'marca', 'tom', 'horario', 'cores'])
  expect(linhas[0]).toEqual({ chave: 'nome', rotulo: 'Nome', resumo: 'Studio Ana' })
  expect(linhas[1].resumo).toBe('@ana')
  expect(linhas[4].resumo).toBe('')
})
