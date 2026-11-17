import { linhasDoResumo } from '../../app/src/cliente/meuNegocio.js'
import { estadoDoNegocio } from '../../app/src/cliente/perguntas.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

test('linhasDoResumo: uma linha por pergunta fixa, sem redes', () => {
  const ramo = RAMOS.beleza
  const linhas = linhasDoResumo(estadoDoNegocio({ nome: 'Studio Ana', insta: '@ana', horario: '19:00' }, [], ramo), ramo)
  expect(linhas.map((l) => l.chave)).toEqual(['nome', 'marca', 'tom', 'horario', 'cores', 'fotos'])
  expect(linhas[0]).toEqual({ chave: 'nome', rotulo: 'Nome', resumo: 'Studio Ana' })
  expect(linhas[1].resumo).toBe('@ana')
  expect(linhas[4].resumo).toBe('')
})

test('linha "Minhas fotos" mostra N fotos, 1 foto ou Nenhuma foto', () => {
  const ramo = RAMOS.beleza
  const resumo = (fotos) => linhasDoResumo(estadoDoNegocio({ nome: 'X', fotos }, [], ramo), ramo).find((l) => l.chave === 'fotos')
  expect(resumo(['a', 'b', 'c'])).toEqual({ chave: 'fotos', rotulo: 'Minhas fotos', resumo: '3 fotos' })
  expect(resumo(['a']).resumo).toBe('1 foto')
  expect(resumo([]).resumo).toBe('Nenhuma foto')
  expect(resumo(undefined).resumo).toBe('Nenhuma foto')
})
