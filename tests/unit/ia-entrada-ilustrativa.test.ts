import { fotoIlustrativa } from '../../supabase/functions/_shared/ia/entrada.ts'
import { escreverNaHora, type DepsNaHora } from '../../supabase/functions/_shared/ia/naHora.ts'
import type { ChamarIA } from '../../supabase/functions/_shared/ia/escrever.ts'

test('fotoIlustrativa: só a pasta banco do próprio cliente', () => {
  expect(fotoIlustrativa('u1', 'u1/banco/gerada-x.jpg')).toBe(true)
  expect(fotoIlustrativa('u1', 'u1/produtos/a.jpg')).toBe(false)
  expect(fotoIlustrativa('u1', 'u2/banco/x.jpg')).toBe(false)
})

test('escreverNaHora com foto do banco avisa o redator que é ilustrativa', async () => {
  const textos: string[] = []
  const chamar: ChamarIA = async (p) => {
    textos.push(p.conteudo.map((c) => (c.tipo === 'texto' ? c.texto : '')).join('\n'))
    return { ok: false, motivo: 'recusa' }
  }
  const deps = {
    chamar: () => chamar, agora: () => 0, registrarUso: async () => {}, contarNoMes: async () => 0,
    urlAssinada: async () => 'https://exemplo/x.jpg',
  } as unknown as DepsNaHora
  await escreverNaHora(deps, {
    clienteId: 'u1',
    dados: { ramo: 'beleza', estrategia: 'vender', negocio: { nome: 'Lia', insta: null, tom: 'proximo' }, produtos: [] },
    post: {
      data: '2026-12-04', rede: 'instagram', tipo: 'feed', formato: 'arte', pilar: 'demo',
      titulo: 't', legenda: 'l', produto_id: null, preco_de: null, preco_por: null,
    },
    foto: { path: 'u1/banco/pixabay-1.jpg', descricao: 'mesa posta' },
  })
  expect(textos.join('\n')).toContain('imagem ilustrativa')
})
