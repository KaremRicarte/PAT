import { resumoServicos } from '../../app/src/cliente/esteMes.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

test('a estratégia não muda depois de gerar: a tela de gerar avisa e o cartão diz que foi definida ao gerar', async () => {
  const { t } = await import('../../app/src/textos.js')
  expect(t('mesq.aviso', { mes: 'dezembro' })).toBe('Atenção: depois de gerar, a estratégia de dezembro não poderá ser trocada.')
  expect(t('este.estrategia.fixa')).toBe('Definida ao gerar o mês.')
})

test('resumo dos serviços: quantidade e quantos estão sem foto', () => {
  const com = { id: 1, nome: 'A', fotos: ['a.jpg'] }
  const sem = { id: 2, nome: 'B', fotos: [] }
  expect(resumoServicos([com, sem, sem, com], RAMOS.beleza)).toBe('4 itens · 2 sem foto')
  expect(resumoServicos([com, sem], RAMOS.beleza)).toBe('2 itens · 1 sem foto')
  expect(resumoServicos([com], RAMOS.beleza)).toBe('1 item')
  expect(resumoServicos([], RAMOS.beleza)).toBe('0 itens')
})
