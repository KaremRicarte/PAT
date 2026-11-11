import {
  situacaoDoPost, corDoDia, resumoDoMes, diaInicial, gradeDoMes, fotoDoPost, pecasDaArte, proximoEstado,
} from '../../app/src/cliente/situacao.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

const post = (estado, extra = {}) => ({ estado, postado_em: null, ...extra })
const postado = post('aprovado', { postado_em: '2026-11-10T12:00:00Z' })
const aprovado = post('aprovado')
const pendente = post('gerado')
const reprovado = post('reprovado')

test('situacaoDoPost: postado vence; reprovado é descartado; gerado/editado são pendentes', () => {
  expect(situacaoDoPost(postado)).toBe('postado')
  expect(situacaoDoPost(post('reprovado', { postado_em: '2026-11-10T12:00:00Z' }))).toBe('postado')
  expect(situacaoDoPost(reprovado)).toBe('reprovado')
  expect(situacaoDoPost(aprovado)).toBe('aprovado')
  expect(situacaoDoPost(pendente)).toBe('pendente')
  expect(situacaoDoPost(post('editado'))).toBe('pendente')
})

test('corDoDia: a cor mais urgente do dia', () => {
  expect(corDoDia([postado, postado])).toBe('postado')
  expect(corDoDia([postado, reprovado])).toBe('postado')
  expect(corDoDia([aprovado, pendente, reprovado])).toBe('pendente')
  expect(corDoDia([aprovado, reprovado])).toBe('reprovado')
  expect(corDoDia([reprovado])).toBe('reprovado')
  expect(corDoDia([aprovado])).toBe('aprovado')
  expect(corDoDia([])).toBeNull()
})

test('resumoDoMes conta por situação', () => {
  expect(resumoDoMes([postado, aprovado, aprovado, pendente, post('editado'), reprovado]))
    .toEqual({ postado: 1, aprovado: 2, pendente: 2, reprovado: 1 })
  expect(resumoDoMes([])).toEqual({ postado: 0, aprovado: 0, pendente: 0, reprovado: 0 })
})

test('diaInicial: hoje se estiver no mês; senão o primeiro dia com post; senão o dia 1', () => {
  const posts = [{ data: '2026-11-20' }, { data: '2026-11-05' }]
  expect(diaInicial('2026-11', '2026-11-11', posts)).toBe('2026-11-11')
  expect(diaInicial('2026-11', '2026-11-11', [])).toBe('2026-11-11')
  expect(diaInicial('2026-12', '2026-11-25', [{ data: '2026-12-03' }, { data: '2026-12-01' }])).toBe('2026-12-01')
  expect(diaInicial('2026-12', '2026-11-25', [])).toBe('2026-12-01')
})

test('gradeDoMes: semana começa no domingo e o tamanho é múltiplo de 7', () => {
  const nov = gradeDoMes('2026-11')
  expect(nov[0]).toBe('2026-11-01')
  expect(nov).toHaveLength(35)
  expect(nov[29]).toBe('2026-11-30')
  expect(nov.slice(30)).toEqual([null, null, null, null, null])
  const dez = gradeDoMes('2026-12')
  expect(dez.slice(0, 3)).toEqual([null, null, '2026-12-01'])
  expect(dez).toHaveLength(35)
  expect(dez.filter(Boolean)).toHaveLength(31)
})

test('fotoDoPost: sem_foto, foto própria, foto do produto e primeira foto', () => {
  const produtos = [{ id: 'a', foto_path: null }, { id: 'b', foto_path: 'fb.jpg' }, { id: 'c', foto_path: 'fc.jpg' }]
  const loja = RAMOS.beleza
  const texto = RAMOS.advocacia
  expect(fotoDoPost({ sem_foto: true, foto_path: 'x.jpg' }, produtos, texto)).toBeNull()
  expect(fotoDoPost({ sem_foto: true, foto_path: 'x.jpg' }, produtos, loja)).toBe('x.jpg')
  expect(fotoDoPost({ foto_path: 'x.jpg' }, produtos, texto)).toBe('x.jpg')
  expect(fotoDoPost({ foto_path: 'x.jpg', produto_id: 'c' }, produtos, loja)).toBe('x.jpg')
  expect(fotoDoPost({ produto_id: 'c' }, produtos, loja)).toBe('fc.jpg')
  expect(fotoDoPost({ produto_id: 'a' }, produtos, loja)).toBe('fb.jpg')
  expect(fotoDoPost({}, produtos, loja)).toBe('fb.jpg')
  expect(fotoDoPost({}, produtos, texto)).toBeNull()
  expect(fotoDoPost({}, [], loja)).toBeNull()
})

test('pecasDaArte: legenda de 5 parágrafos', () => {
  const p = { titulo: 'T', legenda: 'g\n\nm\n\nx\n\nconv\n\nfim' }
  const n = { nome: 'Loja da Ana', insta: '@ana', assinatura: 'ambos' }
  expect(pecasDaArte(p, n, RAMOS.beleza)).toEqual({
    rotulo: 'LOJA DA ANA', titulo: 'T', gancho: 'g', meio: 'm', convite: 'conv',
    assinatura: { texto: '@ana', logo: true },
  })
})

test('pecasDaArte: 3 parágrafos usam o último como convite; 2 parágrafos não têm meio', () => {
  const n = { nome: 'Ana', insta: '@ana', assinatura: 'insta' }
  const tres = pecasDaArte({ titulo: 'T', legenda: 'g\n\nm\n\nc' }, n, RAMOS.beleza)
  expect([tres.gancho, tres.meio, tres.convite]).toEqual(['g', 'm', 'c'])
  expect(tres.assinatura).toEqual({ texto: '@ana', logo: false })
  const dois = pecasDaArte({ titulo: 'T', legenda: 'g\n\nc' }, n, RAMOS.beleza)
  expect([dois.gancho, dois.meio, dois.convite]).toEqual(['g', '', 'c'])
})

test('pecasDaArte: assinatura logo e sem insta', () => {
  const p = { titulo: 'T', legenda: 'g\n\nm\n\nc' }
  expect(pecasDaArte(p, { nome: 'a', insta: '@a', assinatura: 'logo' }, RAMOS.beleza).assinatura)
    .toEqual({ texto: null, logo: true })
  expect(pecasDaArte(p, { nome: 'a', insta: '', assinatura: 'ambos' }, RAMOS.beleza).assinatura)
    .toEqual({ texto: null, logo: true })
  expect(pecasDaArte(p, { nome: 'a', insta: null, assinatura: 'insta' }, RAMOS.beleza).assinatura)
    .toEqual({ texto: null, logo: false })
})

test('proximoEstado: as 6 ações', () => {
  expect(proximoEstado({}, 'aprovar')).toEqual({ estado: 'aprovado' })
  expect(proximoEstado({}, 'desaprovar')).toEqual({ estado: 'gerado' })
  expect(proximoEstado({}, 'desfazer')).toEqual({ estado: 'gerado' })
  expect(proximoEstado({}, 'descartar')).toEqual({ estado: 'reprovado' })
  expect(proximoEstado({}, 'despostar')).toEqual({ postado_em: null })
  const r = proximoEstado({}, 'postei')
  expect(r.estado).toBe('aprovado')
  expect(new Date(r.postado_em).toISOString()).toBe(r.postado_em)
})
