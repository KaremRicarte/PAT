import {
  lerPacote, pacoteAtivo, noitesDoPacote, textoDasRefeicoes, resumoDoPacote, linhasDoCartao, validarPacote,
} from '../../supabase/functions/_shared/modelos/pacote.ts'

const vazio = {
  ativo: true, hotel: null, ida: null, volta: null, transporte: null, transfer: false,
  refeicoes: { cafe: false, almoco: false, jantar: false }, preco_por: null, parcelas: null, taxas: false, pix: null,
}
const completo = {
  ativo: true, hotel: 'Hotel Serra Azul', ida: '2026-12-12', volta: '2026-12-17', transporte: 'aviao', transfer: true,
  refeicoes: { cafe: true, almoco: false, jantar: false }, preco_por: 'pessoa', parcelas: 10, taxas: true, pix: 5,
}

test('lerPacote: sem objeto é null', () => {
  expect(lerPacote(null)).toBe(null)
  expect(lerPacote('x')).toBe(null)
  expect(lerPacote([])).toBe(null)
})

test('lerPacote: limpa valores inválidos e chaves desconhecidas', () => {
  const p = lerPacote({ parcelas: 'x', pix: 90, foo: 1, hotel: '  ', transporte: 'navio', ida: '12/12', preco_por: 'grupo' })!
  expect(p.parcelas).toBe(null)
  expect(p.pix).toBe(null)
  expect('foo' in p).toBe(false)
  expect(p.hotel).toBe(null)
  expect(p.transporte).toBe(null)
  expect(p.ida).toBe(null)
  expect(p.preco_por).toBe(null)
  expect(p.ativo).toBe(false)
  expect(p.refeicoes).toEqual({ cafe: false, almoco: false, jantar: false })
})

test('lerPacote: volta antes da ida vira null; hotel cortado em 80', () => {
  const p = lerPacote({ ida: '2026-12-12', volta: '2026-12-10', hotel: 'x'.repeat(100) })!
  expect(p.volta).toBe(null)
  expect(p.hotel!.length).toBe(80)
})

test('pacoteAtivo: só com ativo true', () => {
  expect(pacoteAtivo({ ...completo, ativo: false })).toBe(null)
  expect(pacoteAtivo(completo)!.hotel).toBe('Hotel Serra Azul')
})

test('noitesDoPacote', () => {
  expect(noitesDoPacote({ ida: '2026-12-12', volta: '2026-12-17' })).toBe(5)
  expect(noitesDoPacote({ ida: '2026-12-12', volta: null })).toBe(null)
})

test('textoDasRefeicoes', () => {
  expect(textoDasRefeicoes({ cafe: true, almoco: false, jantar: false })).toBe('Café da manhã')
  expect(textoDasRefeicoes({ cafe: true, almoco: false, jantar: true })).toBe('Café e jantar')
  expect(textoDasRefeicoes({ cafe: true, almoco: true, jantar: true })).toBe('Pensão completa')
  expect(textoDasRefeicoes({ cafe: false, almoco: true, jantar: true })).toBe('Almoço e jantar')
  expect(textoDasRefeicoes({ cafe: true, almoco: true, jantar: false })).toBe('Café da manhã e almoço')
  expect(textoDasRefeicoes({ cafe: false, almoco: false, jantar: false })).toBe(null)
})

test('resumoDoPacote completo', () => {
  expect(resumoDoPacote(lerPacote(completo)!)).toBe('Hotel Serra Azul; ida 12/12/2026, volta 17/12/2026 (5 noites); aéreo; transfer aeroporto–hotel incluso; café da manhã incluso; preço por pessoa; taxas inclusas; em até 10x; 5% a menos no Pix')
})

test('resumoDoPacote sem preço tira unidade, taxas, parcelas e Pix', () => {
  expect(resumoDoPacote(lerPacote(completo)!, { comPreco: false })).toBe('Hotel Serra Azul; ida 12/12/2026, volta 17/12/2026 (5 noites); aéreo; transfer aeroporto–hotel incluso; café da manhã incluso')
})

test('resumoDoPacote: 1 noite, ônibus, pacote completo', () => {
  const p = lerPacote({ ida: '2026-12-12', volta: '2026-12-13', transporte: 'onibus', preco_por: 'pacote' })!
  expect(resumoDoPacote(p)).toBe('ida 12/12/2026, volta 13/12/2026 (1 noite); rodoviário; preço do pacote completo')
})

test('linhasDoCartao: só o que foi preenchido', () => {
  expect(linhasDoCartao({ ...vazio, hotel: 'X' } as never)).toEqual([{ icone: 'hotel', texto: 'X' }])
  expect(linhasDoCartao(vazio as never)).toEqual([])
})

test('linhasDoCartao completo, na ordem', () => {
  expect(linhasDoCartao(lerPacote(completo)!)).toEqual([
    { icone: 'hotel', texto: 'Hotel Serra Azul' },
    { icone: 'aviao', texto: 'Aéreo' },
    { icone: 'transfer', texto: 'Transfer incluso' },
    { icone: 'data', texto: '12/12 a 17/12 · 5 noites' },
    { icone: 'refeicao', texto: 'Café da manhã' },
  ])
  expect(linhasDoCartao(lerPacote({ ida: '2026-12-12', transporte: 'onibus' })!)).toEqual([
    { icone: 'onibus', texto: 'Rodoviário' },
    { icone: 'data', texto: 'Ida 12/12' },
  ])
})

test('validarPacote', () => {
  expect(validarPacote({ ...vazio, ida: '2026-12-12', volta: '2026-12-10' })).toBe('quiz.item.pacote.erro.volta')
  expect(validarPacote({ ...vazio, parcelas: 30 })).toBe('quiz.item.pacote.erro.parcelas')
  expect(validarPacote({ ...vazio, parcelas: 1 })).toBe('quiz.item.pacote.erro.parcelas')
  expect(validarPacote({ ...vazio, pix: 0 })).toBe('quiz.item.pacote.erro.pix')
  expect(validarPacote(completo)).toBe(null)
  expect(validarPacote(null)).toBe(null)
  expect(validarPacote({ ...vazio, ativo: false, parcelas: 99 })).toBe(null)
})

test('resumoDoPacote: nome sem o tipo ganha "Hotel"', () => {
  expect(resumoDoPacote(lerPacote({ hotel: 'Serra Azul' })!)).toBe('Hotel Serra Azul')
  expect(resumoDoPacote(lerPacote({ hotel: 'Pousada do Sol' })!)).toBe('Pousada do Sol')
})

test('bate-volta (ida = volta): sem "0 noites"', () => {
  const p = lerPacote({ ida: '2026-12-12', volta: '2026-12-12' })!
  expect(resumoDoPacote(p)).toBe('ida e volta 12/12/2026')
  expect(linhasDoCartao(p)).toEqual([{ icone: 'data', texto: '12/12 · bate-volta' }])
})

test('voltaAntesDaIda: aviso na hora, só com as duas datas e a volta antes', async () => {
  const { voltaAntesDaIda } = await import('../../supabase/functions/_shared/modelos/pacote.ts')
  expect(voltaAntesDaIda({ ida: '2026-12-12', volta: '2026-11-17' })).toBe(true)
  expect(voltaAntesDaIda({ ida: '2026-12-12', volta: '2026-12-12' })).toBe(false)
  expect(voltaAntesDaIda({ ida: '2026-12-12', volta: '2026-12-17' })).toBe(false)
  expect(voltaAntesDaIda({ ida: '2026-12-12', volta: null })).toBe(false)
  expect(voltaAntesDaIda({ ida: null, volta: '2026-11-17' })).toBe(false)
})
