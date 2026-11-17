import { textoDoResumo } from '../../app/src/cliente/importarTela.js'

const base = { novos: 0, atualizados: 0, fotos: 0, semItem: [], foraItens: [], foraFotos: [], erros: [], precosIgnorados: false }

describe('textoDoResumo', () => {
  test('exemplo do spec', () => {
    expect(textoDoResumo({ ...base, novos: 3, atualizados: 1, fotos: 14, semItem: ['praia_1.jpg'],
      erros: [{ linha: 4, chave: 'importar.erro.promomaior' }] })).toEqual([
      'Importamos: 3 itens novos · 1 atualizado · 14 fotos',
      '⚠ 1 foto não encontrou item: praia_1.jpg',
      '⚠ Linha 4: o promocional precisa ser menor que o normal',
    ])
  })
  test('plurais e singulares', () => {
    expect(textoDoResumo({ ...base, novos: 1, atualizados: 2, fotos: 1, semItem: ['a.jpg', 'b.jpg'] })).toEqual([
      'Importamos: 1 item novo · 2 atualizados · 1 foto',
      '⚠ 2 fotos não encontraram item: a.jpg, b.jpg',
    ])
  })
  test('limites, preços ignorados e outros arquivos de texto', () => {
    const r = textoDoResumo({ ...base, foraItens: ['Item A', 'Item B'], foraFotos: ['x_1.jpg'], precosIgnorados: true }, { textosIgnorados: 1 })
    expect(r).toContain('⚠ Não couberam (limite de 20 itens), com as fotos: Item A, Item B')
    expect(r).toContain('⚠ Não couberam (limite de 6 fotos por item): x_1.jpg')
    expect(r).toContain('Na sua área, os preços não aparecem nos posts.')
    expect(r).toContain('⚠ Usamos só o primeiro arquivo de texto; 1 outro foi ignorado')
    expect(r[0]).toBe('Nada novo foi importado.')
  })
  test('fotos que o navegador não abriu', () => {
    expect(textoDoResumo({ ...base, naoAbriram: ['a.heic'] })).toContain('⚠ 1 foto não abriu (use JPG ou PNG): a.heic')
    expect(textoDoResumo({ ...base, naoAbriram: ['a.heic', 'b.heic'] })).toContain('⚠ 2 fotos não abriram (use JPG ou PNG): a.heic, b.heic')
  })
})

describe('textoDoAvisoDeFoto', async () => {
  const { textoDoAvisoDeFoto } = await import('../../app/src/cliente/importarTela.js')
  test('o motivo da IA é uma frase inteira, seguida de "Se puder, envie outra."', () => {
    expect(textoDoAvisoDeFoto(2, 'A foto está escura; tente tirar perto de uma janela.'))
      .toBe('Foto 2: A foto está escura; tente tirar perto de uma janela. Se puder, envie outra.')
    expect(textoDoAvisoDeFoto(1, '  A foto está tremida ')).toBe('Foto 1: A foto está tremida. Se puder, envie outra.')
  })
  test('sem motivo: texto padrão', () => {
    expect(textoDoAvisoDeFoto(3, null)).toBe('Foto 3: Ela ficou fora do ideal. Se puder, envie outra.')
    expect(textoDoAvisoDeFoto(3, '  ')).toBe('Foto 3: Ela ficou fora do ideal. Se puder, envie outra.')
  })
})
