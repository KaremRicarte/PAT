import { agendaDoMes, mesAlvo, hojeEmSaoPaulo, nomeDoMes } from '../../supabase/functions/_shared/modelos/calendario.ts'

test('mês inteiro de dezembro de 2026', () => {
  const a = agendaDoMes('2026-12', '2026-12-01', 'vender')
  expect(a.feed).toEqual([
    '2026-12-02', '2026-12-04', '2026-12-07', '2026-12-09', '2026-12-11', '2026-12-14',
    '2026-12-16', '2026-12-18', '2026-12-21', '2026-12-23', '2026-12-25', '2026-12-28',
  ])
  expect(a.videos).toEqual(['2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22'])
  expect(a.status).toEqual([
    '2026-12-01', '2026-12-03', '2026-12-08', '2026-12-10', '2026-12-15', '2026-12-17', '2026-12-22', '2026-12-24',
  ])
  expect(a.lista).toEqual(['2026-12-03', '2026-12-17'])
})

test('crescer tem até 6 vídeos em terças e quintas', () => {
  expect(agendaDoMes('2026-12', '2026-12-01', 'crescer').videos)
    .toEqual(['2026-12-01', '2026-12-03', '2026-12-08', '2026-12-10', '2026-12-15', '2026-12-17'])
})

test('começando no dia 16 de novembro', () => {
  expect(agendaDoMes('2026-11', '2026-11-16', 'tempo')).toEqual({
    feed: ['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23', '2026-11-25', '2026-11-27', '2026-11-30'],
    videos: ['2026-11-17', '2026-11-24'],
    status: ['2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26'],
    lista: ['2026-11-19'],
  })
})

test.each([
  ['2026-11-10', [], { anoMes: '2026-11', inicio: '2026-11-10' }],
  ['2026-11-20', [], { anoMes: '2026-11', inicio: '2026-11-20' }],
  ['2026-11-21', [], { anoMes: '2026-12', inicio: '2026-12-01' }],
  ['2026-11-10', ['2026-11'], null],
  ['2026-11-25', ['2026-11'], { anoMes: '2026-12', inicio: '2026-12-01' }],
  ['2026-12-22', ['2026-12'], { anoMes: '2027-01', inicio: '2027-01-01' }],
  ['2026-11-25', ['2026-11', '2026-12'], null],
])('mesAlvo(%s, %j)', (hoje, gerados, esperado) => {
  expect(mesAlvo(hoje, gerados)).toEqual(esperado)
})

test('hojeEmSaoPaulo usa o fuso de Brasília', () => {
  expect(hojeEmSaoPaulo(new Date('2026-11-11T02:30:00Z'))).toBe('2026-11-10')
  expect(hojeEmSaoPaulo(new Date('2026-11-11T03:30:00Z'))).toBe('2026-11-11')
})

test('nomeDoMes', () => {
  expect(nomeDoMes('2027-01')).toBe('janeiro de 2027')
  expect(nomeDoMes('2026-11')).toBe('novembro de 2026')
})
