import { descreverFoto } from '../../supabase/functions/_shared/ia/descrever.ts'
import type { ChamarIA } from '../../supabase/functions/_shared/ia/escrever.ts'

type Pedido = Parameters<ChamarIA>[0]

function falsa(r: Awaited<ReturnType<ChamarIA>>) {
  const pedidos: Pedido[] = []
  const chamar: ChamarIA = async (p) => { pedidos.push(p); return r }
  return { chamar, pedidos }
}

test('(f) foto escura: serve false com o motivo', async () => {
  const { chamar, pedidos } = falsa({
    ok: true, tokensEntrada: 1500, tokensSaida: 80,
    dados: { descricao: 'Mesa de madeira com ferramentas, quase sem luz.', serve: false, motivo: 'A foto está escura demais.' },
  })
  const r = await descreverFoto(chamar, { url: 'https://exemplo/f.jpg', contexto: 'Loja de ferramentas · Furadeira' })
  expect(r).toEqual({
    descricao: 'Mesa de madeira com ferramentas, quase sem luz.', serve: false, motivo: 'A foto está escura demais.',
    tokens: { entrada: 1500, saida: 80 },
  })
  expect(pedidos[0].conteudo).toContainEqual({ tipo: 'imagem', url: 'https://exemplo/f.jpg' })
  expect(pedidos[0].conteudo.some((c) => c.tipo === 'texto' && c.texto.includes('Furadeira'))).toBe(true)
  expect((pedidos[0].esquema as { required: string[] }).required.sort()).toEqual(['descricao', 'motivo', 'serve'])
  expect(pedidos[0].sistema).toMatch(/nítida/)
})

test('foto boa: serve true e motivo null', async () => {
  const { chamar } = falsa({ ok: true, tokensEntrada: 1, tokensSaida: 1, dados: { descricao: 'Bolo de chocolate.', serve: true, motivo: 'qualquer' } })
  const r = await descreverFoto(chamar, { url: 'u', contexto: '' })
  expect(r!.serve).toBe(true)
  expect(r!.motivo).toBeNull()
})

test('reprovada sem motivo ganha um motivo padrão', async () => {
  const { chamar } = falsa({ ok: true, tokensEntrada: 1, tokensSaida: 1, dados: { descricao: 'Foto tremida.', serve: false, motivo: null } })
  const r = await descreverFoto(chamar, { url: 'u', contexto: '' })
  expect(r!.motivo).toBeTruthy()
})

test('recusa ou resposta fora do formato → null', async () => {
  expect(await descreverFoto(falsa({ ok: false, motivo: 'recusa' }).chamar, { url: 'u', contexto: '' })).toBeNull()
  expect(await descreverFoto(falsa({ ok: true, tokensEntrada: 1, tokensSaida: 1, dados: { serve: true } }).chamar,
    { url: 'u', contexto: '' })).toBeNull()
})
