import { dataPorExtenso, escreverPost, motivoDoErroHttp, type ChamarIA, type EntradaPost } from '../../supabase/functions/_shared/ia/escrever.ts'
import { INSTRUCOES_POST } from '../../supabase/functions/_shared/ia/instrucoes.ts'
import { custoUsd } from '../../supabase/functions/_shared/ia/custo.ts'

type Pedido = Parameters<ChamarIA>[0]

const entrada = (extra: Partial<EntradaPost> = {}, lugar: Partial<EntradaPost['lugar']> = {}): EntradaPost => ({
  ramo: 'beleza',
  negocio: { nome: 'Studio Lia', insta: 'studiolia', tom: 'proximo' },
  estrategia: 'vender',
  lugar: { data: '2026-12-04', rede: 'instagram', tipo: 'feed', formato: 'arte', pilar: 'demo', preco_de: null, preco_por: null, ...lugar },
  produto: { nome: 'Escova progressiva', descricao: 'Alisamento com acabamento natural' },
  foto: { url: 'https://exemplo/foto.jpg', descricao: 'Cabelo castanho liso e brilhante, visto de costas, em salão claro.' },
  textoModelo: 'Cabelo liso o dia todo?\n\nConheça a escova progressiva.',
  textosDoCliente: ['Studio Lia', 'Escova progressiva', 'Alisamento com acabamento natural'],
  ...extra,
})

const resposta = (extra: Record<string, unknown> = {}) => ({
  titulo: 'O brilho que dura a semana inteira',
  gancho: 'Esse brilho aí da foto não é filtro.',
  meio: 'É a escova progressiva feita com calma: lavagem, aplicação mecha por mecha e finalização.',
  convite: 'Quer o seu? Chama no WhatsApp e escolhe o horário.',
  hashtags: ['#escovaprogressiva', '#cabelo'],
  roteiro: 'Como montar: a foto inteira, com o título por cima.',
  ...extra,
})

function falsa(...respostas: Awaited<ReturnType<ChamarIA>>[]) {
  const pedidos: Pedido[] = []
  const chamar: ChamarIA = async (p) => {
    pedidos.push(p)
    return respostas[Math.min(pedidos.length - 1, respostas.length - 1)]
  }
  return { chamar, pedidos }
}
const ok = (dados: unknown) => ({ ok: true as const, dados, tokensEntrada: 1000, tokensSaida: 200 })
const textoDo = (p: Pedido) => p.conteudo.map((c) => (c.tipo === 'texto' ? c.texto : '')).join('\n')

test('(a) resposta válida vira legenda em parágrafos, com os campos certos', async () => {
  const { chamar, pedidos } = falsa(ok(resposta()))
  const r = await escreverPost(chamar, entrada())
  expect(r).not.toBeNull()
  expect(r!.post).toEqual({
    titulo: 'O brilho que dura a semana inteira',
    legenda: 'Esse brilho aí da foto não é filtro.\n\n' +
      'É a escova progressiva feita com calma: lavagem, aplicação mecha por mecha e finalização.\n\n' +
      'Quer o seu? Chama no WhatsApp e escolhe o horário.',
    hashtags: ['#escovaprogressiva', '#cabelo'],
    roteiro: 'Como montar: a foto inteira, com o título por cima.',
  })
  expect(r!.tentativas).toBe(1)
  expect(r!.tokens).toEqual({ entrada: 1000, saida: 200 })
  expect(pedidos).toHaveLength(1)
  // a foto vai junto, o sistema é o texto estável e o esquema pede os campos da IA
  expect(pedidos[0].conteudo).toContainEqual({ tipo: 'imagem', url: 'https://exemplo/foto.jpg' })
  expect(pedidos[0].sistema).toBe(INSTRUCOES_POST)
  expect(textoDo(pedidos[0])).toContain('Cabelo castanho liso e brilhante')
  expect((pedidos[0].esquema as { required: string[] }).required.sort())
    .toEqual(['convite', 'gancho', 'hashtags', 'meio', 'roteiro', 'titulo'])
})

test('(a) Facebook ganha a assinatura do negócio no fim, como nos modelos', async () => {
  const { chamar } = falsa(ok(resposta()))
  const r = await escreverPost(chamar, entrada({}, { rede: 'facebook' }))
  expect(r!.post.legenda.endsWith('\n\nStudio Lia · Instagram @studiolia')).toBe(true)
})

test('(a) WhatsApp e stories ficam sem hashtags', async () => {
  const { chamar } = falsa(ok(resposta()))
  const r = await escreverPost(chamar, entrada({}, { rede: 'whatsapp', tipo: 'status', formato: 'texto' }))
  expect(r!.post.hashtags).toEqual([])
})

test('(b) psicologia com "promoção": a 2ª chamada recebe os problemas; 2ª ruim → null', async () => {
  const ruim = ok(resposta({ meio: 'Aproveite a promoção desta semana para começar a terapia.' }))
  const { chamar, pedidos } = falsa(ruim, ruim)
  const r = await escreverPost(chamar, entrada({
    ramo: 'psicologia',
    produto: { nome: 'Terapia online', descricao: null },
    textosDoCliente: ['Studio Lia', 'Terapia online'],
  }))
  expect(r).toBeNull()
  expect(pedidos).toHaveLength(2)
  expect(textoDo(pedidos[1])).toContain('preço ou promoção num ramo que não permite')
  expect(textoDo(pedidos[0])).not.toContain('preço ou promoção num ramo que não permite')
  // o ramo com conselho vai avisado já na primeira chamada
  expect(textoDo(pedidos[0])).toMatch(/sem preço/i)
})

test('(b) a 2ª chamada boa vale, com 2 tentativas e tokens somados', async () => {
  const { chamar } = falsa(ok(resposta({ meio: 'Promoção de inverno!' })), ok(resposta()))
  const r = await escreverPost(chamar, entrada({ ramo: 'psicologia' }))
  expect(r!.tentativas).toBe(2)
  expect(r!.tokens).toEqual({ entrada: 2000, saida: 400 })
})

test('(b) resposta fora do formato também conta como reprovada e tenta de novo', async () => {
  const { chamar, pedidos } = falsa(ok({ titulo: 'só isso' }), ok(resposta()))
  const r = await escreverPost(chamar, entrada())
  expect(r).not.toBeNull()
  expect(pedidos).toHaveLength(2)
})

test('(c) recusa → null sem 2ª chamada', async () => {
  const { chamar, pedidos } = falsa({ ok: false, motivo: 'recusa' })
  expect(await escreverPost(chamar, entrada())).toBeNull()
  expect(pedidos).toHaveLength(1)
})

test('(c) erro na 2ª chamada → null', async () => {
  const { chamar, pedidos } = falsa(ok(resposta({ titulo: '' })), { ok: false, motivo: 'tempo' })
  expect(await escreverPost(chamar, entrada())).toBeNull()
  expect(pedidos).toHaveLength(2)
})

test('(d) post de promoção: os valores vão nas instruções e a legenda leva o texto de valor dos modelos', async () => {
  const { chamar, pedidos } = falsa(ok(resposta({ titulo: 'Escova com oferta especial' })))
  const r = await escreverPost(chamar, entrada({}, { preco_de: 180, preco_por: 149.9 }))
  const texto = textoDo(pedidos[0])
  expect(texto).toContain('R$ 180')
  expect(texto).toContain('R$ 149,90')
  expect(r!.post.legenda).toContain('\n\nDe R$ 180 por R$ 149,90. Aproveite enquanto durar!\n\n')
  // o preço fica entre o meio e o convite
  expect(r!.post.legenda.indexOf('De R$ 180')).toBeGreaterThan(r!.post.legenda.indexOf('mecha por mecha'))
  expect(r!.post.legenda.indexOf('De R$ 180')).toBeLessThan(r!.post.legenda.indexOf('Quer o seu?'))
})

test('promoção: título que não fala da oferta é recusado e a IA tenta de novo', async () => {
  const { chamar, pedidos } = falsa(ok(resposta()), ok(resposta({ titulo: 'Escova com oferta especial' })))
  const r = await escreverPost(chamar, entrada({}, { preco_de: 180, preco_por: 149.9 }))
  expect(r!.tentativas).toBe(2)
  expect(textoDo(pedidos[0])).toMatch(/oferta precisa ficar evidente/)
  expect(textoDo(pedidos[1])).toMatch(/título de promoção sem falar da oferta/)
})

test('promoção com data: a IA sabe a fase e a legenda leva o prazo', async () => {
  const { chamar, pedidos } = falsa(ok(resposta({ titulo: 'Vem aí a oferta de Natal' })))
  const ocasiao = { nome: 'Natal', data: '2026-12-25', fase: 'aquecimento' as const }
  const r = await escreverPost(chamar, entrada({}, { preco_de: 180, preco_por: 149.9, ocasiao }))
  expect(textoDo(pedidos[0])).toMatch(/aquecimento: a oferta de Natal vale só no dia 25\/12/)
  expect(r!.post.legenda).toContain('\n\nOferta de Natal, só no dia 25/12: de R$ 180 por R$ 149,90.\n\n')
})

test('data sem promoção (tema): a IA liga o post à data, sem falar de promoção', async () => {
  const { chamar, pedidos } = falsa(ok(resposta()))
  await escreverPost(chamar, entrada({}, { ocasiao: { nome: 'Natal', data: '2026-12-25', fase: 'tema' } }))
  expect(textoDo(pedidos[0])).toMatch(/Este post é do dia Natal, 25\/12 .*sem falar de preço, promoção ou desconto/)
})

test('(d) vitrine de preço: só "Por R$ …."', async () => {
  const { chamar } = falsa(ok(resposta()))
  const r = await escreverPost(chamar, entrada({}, { preco_por: 90 }))
  expect(r!.post.legenda).toContain('\n\nPor R$ 90.\n\n')
})

test('(d) post sem preço não menciona preço nas instruções do post', async () => {
  const { chamar, pedidos } = falsa(ok(resposta()))
  await escreverPost(chamar, entrada())
  const texto = textoDo(pedidos[0])
  expect(texto).not.toMatch(/R\$/)
  expect(texto).not.toMatch(/texto de preço/i)
})

test('(d) a IA citar um valor diferente do informado reprova', async () => {
  const { chamar, pedidos } = falsa(ok(resposta({ titulo: 'Escova com oferta especial', meio: 'Hoje sai por R$ 99.' })), ok(resposta({ titulo: 'Escova com oferta especial' })))
  const r = await escreverPost(chamar, entrada({}, { preco_de: 180, preco_por: 149.9 }))
  expect(r!.tentativas).toBe(2)
  expect(textoDo(pedidos[1])).toMatch(/valor/)
})

test('(d) preço num ramo noPromo é ignorado', async () => {
  const { chamar, pedidos } = falsa(ok(resposta()))
  const r = await escreverPost(chamar, entrada({ ramo: 'advocacia' }, { preco_de: 300, preco_por: 200 }))
  expect(textoDo(pedidos[0])).not.toMatch(/R\$/)
  expect(r!.post.legenda).not.toMatch(/R\$/)
})

test('(e) as instruções sempre proíbem inventar depoimentos, números e garantias', () => {
  expect(INSTRUCOES_POST).toMatch(/depoimentos/)
  expect(INSTRUCOES_POST).toMatch(/números/)
  expect(INSTRUCOES_POST).toMatch(/garantias/)
  expect(INSTRUCOES_POST).toMatch(/nunca invente/i)
})

test('(e) as instruções cobrem gancho, retenção, desejo, reputação e o peso de cada estratégia', () => {
  for (const p of ['gancho', 'retenção', 'desejo', 'reputação', 'Vender mais', 'Crescer o perfil', 'Credibilidade', 'Economizar tempo']) {
    expect(INSTRUCOES_POST).toContain(p)
  }
})

test('(g) custoUsd: US$ 4 por milhão de entrada e US$ 20 por milhão de saída', () => {
  expect(custoUsd(1_000_000, 0)).toBe(4)
  expect(custoUsd(0, 1_000_000)).toBe(20)
  expect(custoUsd(1000, 200)).toBeCloseTo(0.008, 10)
})

test('post sem preço (beleza) com "desconto": 2ª chamada recebe o problema; 2ª ruim → null', async () => {
  const ruim = ok(resposta({ meio: 'Aproveite o desconto desta semana.' }))
  const { chamar, pedidos } = falsa(ruim, ruim)
  expect(await escreverPost(chamar, entrada())).toBeNull()
  expect(pedidos).toHaveLength(2)
  expect(textoDo(pedidos[1])).toContain('fala de promoção/desconto/oferta num post sem preço')
})

test('palavra de promoção no texto do cliente não reprova o post sem preço', async () => {
  const { chamar } = falsa(ok(resposta({ meio: 'Conheça o Combo Oferta da Lia, feito com calma.' })))
  const r = await escreverPost(chamar, entrada({ textosDoCliente: ['Studio Lia', 'Combo Oferta da Lia'] }))
  expect(r).not.toBeNull()
})

test('post de promoção pode falar em promoção', async () => {
  const { chamar } = falsa(ok(resposta({ titulo: 'Escova com oferta especial', meio: 'A promoção vale para a escova completa.' })))
  expect(await escreverPost(chamar, entrada({}, { preco_de: 180, preco_por: 149.9 }))).not.toBeNull()
})

test('valores em reais iguais aos informados passam com qualquer espaço (ou sem espaço)', async () => {
  for (const v of ['R$149,90', 'R$ 149,90', 'R$  149,90']) {
    const { chamar } = falsa(ok(resposta({ titulo: 'Escova com oferta especial', meio: `Hoje sai por ${v}.` })))
    const r = await escreverPost(chamar, entrada({}, { preco_de: 180, preco_por: 149.9 }))
    expect(r?.tentativas).toBe(1)
  }
  // com espaço duplo o valor errado também é visto
  const { chamar } = falsa(ok(resposta({ titulo: 'Escova com oferta especial', meio: 'Hoje sai por R$  99.' })), ok(resposta({ titulo: 'Escova com oferta especial' })))
  expect((await escreverPost(chamar, entrada({}, { preco_de: 180, preco_por: 149.9 })))!.tentativas).toBe(2)
})

test('hashtags a mais são cortadas no máximo da rede, sem reprovar', async () => {
  const muitas = ['#a', '#b', '#c', '#d', '#e', '#f', '#g']
  const ig = falsa(ok(resposta({ hashtags: muitas })))
  const r = await escreverPost(ig.chamar, entrada())
  expect(r!.tentativas).toBe(1)
  expect(r!.post.hashtags).toEqual(['#a', '#b', '#c', '#d', '#e'])
  const fb = falsa(ok(resposta({ hashtags: muitas })))
  expect((await escreverPost(fb.chamar, entrada({}, { rede: 'facebook' })))!.post.hashtags).toEqual(['#a', '#b', '#c'])
})

test('a data vai também por extenso (dia da semana, dia e mês) e as instruções proíbem urgência inventada', async () => {
  expect(dataPorExtenso('2026-12-04')).toBe('sexta-feira, 4 de dezembro')
  expect(dataPorExtenso('2026-11-01')).toBe('domingo, 1 de novembro')
  expect(dataPorExtenso('xx')).toBe('xx')
  const { chamar, pedidos } = falsa(ok(resposta()))
  await escreverPost(chamar, entrada())
  expect(textoDo(pedidos[0])).toContain('2026-12-04 (sexta-feira, 4 de dezembro)')
  expect(INSTRUCOES_POST).toMatch(/só até sexta/)
})

test('escrever o post: max_tokens 16000 (o pensamento conta) e o esforço padrão', async () => {
  const { chamar, pedidos } = falsa(ok(resposta()))
  await escreverPost(chamar, entrada())
  expect(pedidos[0].maxTokens).toBe(16000)
  expect(pedidos[0].esforco).toBeUndefined()
})

test('motivoDoErroHttp: 429, 529 e 5xx são passageiros (ocupado); o resto é erro', () => {
  expect(motivoDoErroHttp(429)).toBe('ocupado')
  expect(motivoDoErroHttp(529)).toBe('ocupado')
  expect(motivoDoErroHttp(500)).toBe('ocupado')
  expect(motivoDoErroHttp(503)).toBe('ocupado')
  expect(motivoDoErroHttp(400)).toBe('erro')
  expect(motivoDoErroHttp(401)).toBe('erro')
  expect(motivoDoErroHttp(undefined)).toBe('erro')
})

test('API ocupada → null (quem chama na hora segue com o modelo)', async () => {
  const { chamar, pedidos } = falsa({ ok: false, motivo: 'ocupado' })
  expect(await escreverPost(chamar, entrada())).toBeNull()
  expect(pedidos).toHaveLength(1)
})

test('foto ilustrativa avisa o redator que não é do negócio', async () => {
  const { chamar, pedidos } = falsa(ok(resposta()))
  await escreverPost(chamar, entrada({ foto: { url: 'https://exemplo/b.jpg', descricao: 'mesa posta', ilustrativa: true } }))
  const texto = textoDo(pedidos[0])
  expect(texto).toContain('imagem ilustrativa, não é do negócio')
  expect(texto).toContain('mesa posta')
})

test('foto sem ilustrativa segue como foto anexada do cliente', async () => {
  const { chamar, pedidos } = falsa(ok(resposta()))
  await escreverPost(chamar, entrada({ foto: { url: 'https://exemplo/b.jpg', descricao: 'mesa posta' } }))
  const texto = textoDo(pedidos[0])
  expect(texto).toContain('Foto do post (anexada): mesa posta')
  expect(texto).not.toContain('ilustrativa')
})

test('story: a IA escreve uma enquete (pergunta + duas opções curtas); fora desse formato, tenta de novo', async () => {
  const enquete = { titulo: 'Você já viu as piscinas naturais?', gancho: 'Você já viu as piscinas naturais?', meio: 'Enquete: Já vi / Quero ver', convite: '', hashtags: [], roteiro: null }
  const { chamar, pedidos } = falsa(ok(resposta({ titulo: 'Piscinas naturais', meio: 'Um texto longo qualquer.' })), ok(resposta(enquete)))
  const r = await escreverPost(chamar, entrada({}, { tipo: 'stories', formato: 'arte', pilar: 'demo' }))
  expect(r!.tentativas).toBe(2)
  expect(textoDo(pedidos[0])).toMatch(/ENQUETE/)
  expect(textoDo(pedidos[1])).toMatch(/não é uma pergunta curta/)
  expect(r!.post.legenda).toBe('Você já viu as piscinas naturais?\n\nEnquete: Já vi / Quero ver')
})

test('com evitar (título anterior), o pedido de escrita traz o título a evitar; sem ele, não', async () => {
  const a = falsa(ok(resposta()))
  await escreverPost(a.chamar, entrada({ evitar: 'Oferta de Black Friday para Gramado chega no dia 27/11' }))
  expect(textoDo(a.pedidos[0])).toContain('não repita este título')
  expect(textoDo(a.pedidos[0])).toContain('Oferta de Black Friday para Gramado chega no dia 27/11')
  const b = falsa(ok(resposta()))
  await escreverPost(b.chamar, entrada())
  expect(textoDo(b.pedidos[0])).not.toContain('não repita este título')
})
