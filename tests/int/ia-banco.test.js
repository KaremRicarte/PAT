import { servico, novoCliente, novoNegocio, novaAdmin, limpar, criados } from './ajuda.js'
import { randomUUID } from 'node:crypto'

afterEach(() => limpar(criados.splice(0)))

const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const maisDias = (n) => {
  const d = new Date(`${hoje()}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Mês e posts criados à mão (a função gerar-mes não é necessária aqui).
async function mesComPosts(cliente, posts) {
  const s = servico()
  const { data: mes, error } = await s.from('meses').insert({
    cliente_id: cliente.id, ano_mes: hoje().slice(0, 7), estrategia: 'vender', origem: 'modelo',
  }).select('id').single()
  if (error) throw error
  const linhas = posts.map((p, i) => ({
    mes_id: mes.id, data: maisDias(2), rede: 'instagram', tipo: 'feed', formato: 'arte', pilar: 'demo',
    titulo: `T${i}`, legenda: 'x', horario: '08:00', ordem: i, estado: 'gerado', ...p,
  }))
  const { data, error: e2 } = await s.from('posts').insert(linhas).select('*')
  if (e2) throw e2
  return { mesId: mes.id, posts: data }
}

test('post novo nasce modelo e na fila; cliente não altera origem nem ia_estado', async () => {
  const a = await novoCliente({ senha_provisoria: false })
  const { posts } = await mesComPosts(a, [{}])
  expect(posts[0].origem).toBe('modelo')
  expect(posts[0].ia_estado).toBe('fila')
  const r1 = await a.db.from('posts').update({ origem: 'ia' }).eq('id', posts[0].id)
  expect(r1.error).not.toBeNull()
  const r2 = await a.db.from('posts').update({ ia_estado: 'pronto' }).eq('id', posts[0].id)
  expect(r2.error).not.toBeNull()
  const { data } = await servico().from('posts').select('origem,ia_estado').eq('id', posts[0].id).single()
  expect(data).toEqual({ origem: 'modelo', ia_estado: 'fila' })
})

test('aprovar tira o post da fila', async () => {
  const a = await novoCliente({ senha_provisoria: false })
  const { posts } = await mesComPosts(a, [{}])
  const r = await a.db.from('posts').update({ estado: 'aprovado' }).eq('id', posts[0].id)
  expect(r.error).toBeNull()
  const { data } = await servico().from('posts').select('ia_estado').eq('id', posts[0].id).single()
  expect(data.ia_estado).toBe('pulado')
})

test('pegar_posts_para_ia: só com serviço, ignora aprovado e passado, sem repetir', async () => {
  const a = await novoCliente({ senha_provisoria: false })
  const { posts } = await mesComPosts(a, [
    { data: maisDias(2) }, { data: maisDias(3) },
    { data: maisDias(4), estado: 'aprovado' }, { data: maisDias(-3) },
  ])
  const meus = new Set(posts.map((p) => p.id))
  const negado = await a.db.rpc('pegar_posts_para_ia', { p_limite: 5 })
  expect(negado.error).not.toBeNull()

  const s = servico()
  // o banco de teste pode ter outros posts na fila: pega bastante e filtra os meus
  const r1 = await s.rpc('pegar_posts_para_ia', { p_limite: 1000 })
  expect(r1.error).toBeNull()
  const meusPegos = r1.data.filter((p) => meus.has(p.id))
  expect(meusPegos.map((p) => p.titulo).sort()).toEqual(['T0', 'T1'])
  expect(meusPegos.every((p) => p.ia_estado === 'trabalhando' && p.ia_em)).toBe(true)

  const r2 = await s.rpc('pegar_posts_para_ia', { p_limite: 1000 })
  expect(r2.error).toBeNull()
  expect(r2.data.filter((p) => meus.has(p.id))).toHaveLength(0)
})

test('fotos_ia: cliente lê só as próprias; admin lê todas; cliente não insere', async () => {
  const a = await novoCliente({ senha_provisoria: false })
  const b = await novoCliente({ senha_provisoria: false })
  const adm = await novaAdmin()
  const s = servico()
  const pa = `${a.id}/negocio/${randomUUID()}.jpg`
  const pb = `${b.id}/negocio/${randomUUID()}.jpg`
  const { error } = await s.from('fotos_ia').insert([
    { path: pa, cliente_id: a.id, origem: 'cliente', serve: true },
    { path: pb, cliente_id: b.id, origem: 'cliente', serve: true },
  ])
  expect(error).toBeNull()
  const { data } = await a.db.from('fotos_ia').select('path')
  expect(data.map((x) => x.path)).toEqual([pa])
  const ins = await a.db.from('fotos_ia').insert({ path: `${a.id}/x.jpg`, cliente_id: a.id, origem: 'cliente' })
  expect(ins.error).not.toBeNull()
  const { data: todas } = await adm.db.from('fotos_ia').select('path').in('path', [pa, pb])
  expect(todas).toHaveLength(2)
})

test('cliente não lê uso_ia nem o bucket banco; admin lê uso_ia e o bucket', async () => {
  const a = await novoCliente({ senha_provisoria: false })
  const adm = await novaAdmin()
  const s = servico()
  const { error } = await s.from('uso_ia').insert({ cliente_id: a.id, tipo: 'post', tokens_entrada: 1, tokens_saida: 1, custo_usd: 0.001 })
  expect(error).toBeNull()
  const r = await a.db.from('uso_ia').select('*')
  expect(r.data ?? []).toHaveLength(0)
  const ra = await adm.db.from('uso_ia').select('*').eq('cliente_id', a.id)
  expect(ra.data.length).toBeGreaterThan(0)
  const { data: n } = await s.rpc('uso_ia_no_mes', { p_cliente: a.id })
  expect(n).toBe(1)

  const caminho = `teste/${randomUUID()}.jpg`
  const up = await s.storage.from('banco').upload(caminho, new Uint8Array([255, 216, 255, 217]), { contentType: 'image/jpeg' })
  expect(up.error).toBeNull()
  try {
    const dl = await a.db.storage.from('banco').download(caminho)
    expect(dl.error).not.toBeNull()
    const lista = await a.db.storage.from('banco').list('teste')
    expect(lista.data ?? []).toHaveLength(0)
    const dlAdmin = await adm.db.storage.from('banco').download(caminho)
    expect(dlAdmin.error).toBeNull()
  } finally {
    await s.storage.from('banco').remove([caminho])
  }
})

test('negocios.fotos com 31 itens é recusado; 30 passa', async () => {
  const a = await novoCliente({ senha_provisoria: false })
  await novoNegocio(a)
  const fotos = (n) => Array.from({ length: n }, () => `${a.id}/negocio/${randomUUID()}.jpg`)
  const ruim = await servico().from('negocios').update({ fotos: fotos(31) }).eq('cliente_id', a.id)
  expect(ruim.error).not.toBeNull()
  const bom = await servico().from('negocios').update({ fotos: fotos(30) }).eq('cliente_id', a.id)
  expect(bom.error).toBeNull()
})
