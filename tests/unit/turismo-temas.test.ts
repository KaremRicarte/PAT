// Os temas de conteúdo do Turismo: os 12 novos existem e nenhum texto tem palavra proibida ou sobra de modelo.
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'
// a mesma regra que o validador usa nos posts sem preço (validar.ts), mais o R$
const PROMOCAO = /R\$|(?<!\p{L})(promo(ção|ções|cional|cionais|s)?|descontos?|off)(?!\p{L})|black friday/iu

const NOVOS = [
  'Checklist: o que levar na sua bagagem?', '5 destinos para viajar sem passaporte', 'Documentos que você precisa antes de embarcar',
  '5 erros que encarecem a sua viagem', 'Qual o peso ideal da bagagem?', 'Lembrete: não se atrase para o embarque!',
  'Quando é a melhor época para comprar a sua viagem?', 'Qual vai ser a sua próxima viagem?', 'Enquete: próxima viagem nacional ou internacional?',
  'Motivos para viajar com uma agência', 'Viajou com a gente? Conta como foi!', '#partiu: a viagem dos seus sonhos espera por você',
]

test('Turismo tem os 12 temas novos', () => {
  const titulos = RAMOS.turismo.aprox.map((a) => a.t)
  for (const t of NOVOS) expect(titulos).toContain(t)
})

test('nenhum tema do Turismo tem palavra de promoção, preço ou sobra de modelo; todos têm os 4 campos', () => {
  for (const a of RAMOS.turismo.aprox) {
    const textos = [a.t, ...a.f.map((x) => x[1])].join(' ')
    expect(textos).not.toMatch(PROMOCAO)
    expect(textos).not.toMatch(/undefined/) // {prod} e {loja} são trocados na hora de gerar
    expect(a.f.map((x) => x[0])).toEqual(['Gancho', 'Conteúdo', 'Conexão', 'Convite'])
  }
})

test('o mês do Turismo usa os temas novos e todos os posts passam nas checagens', async () => {
  const { gerarMes } = await import('../../supabase/functions/_shared/modelos/gerar.ts')
  const { validarPost } = await import('../../supabase/functions/_shared/modelos/validar.ts')
  const titulos = new Set<string>()
  for (const [anoMes, estrategia] of [['2026-12', 'vender'], ['2027-01', 'crescer'], ['2027-02', 'credibilidade']] as const) {
    const posts = gerarMes({ ramo: 'turismo', estrategia, anoMes, inicio: `${anoMes}-01`,
      negocio: { nome: 'Malibu', insta: '@malibu', tom: 'proximo', horario: '19:00' },
      produtos: [{ id: 'g', nome: 'Gramado', descricao: null, preco: 2199, preco_promo: 1799, pacote: { ativo: true } },
        { id: 'p', nome: 'Portugal', descricao: null, preco: null, preco_promo: null }] })
    for (const p of posts) {
      expect(validarPost(p, RAMOS.turismo, ['Malibu', 'Gramado', 'Portugal'])).toEqual([])
      titulos.add(p.titulo)
    }
  }
  expect(NOVOS.filter((t) => titulos.has(t)).length).toBeGreaterThanOrEqual(4)
})
