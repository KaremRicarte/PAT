// Dados do negócio do cliente: leitura, gravação e preparo das fotos.
// O cliente do Supabase vem por parâmetro, para as funções puras poderem ser testadas sem rede.
import { esquecerImagem } from '../artes/imagens.js'
import { temPromocao } from '../../../supabase/functions/_shared/modelos/validar.ts'

export const MAX_ITENS = 20
export const MAX_FOTOS = 6
export const FOTO_MAX = 1600 // lado maior das fotos, em px
export const LOGO_MAX = 800

// Nova medida mantendo a proporção; nunca aumenta a imagem.
export function medidaReduzida(largura, altura, maximo) {
  const fator = Math.min(1, maximo / Math.max(largura, altura))
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) }
}

// Devolve a chave de texto do primeiro problema, ou null se a lista está boa.
// Em ramos com regras de conselho (noPromo), nome e descrição não podem falar de preço/promoção.
export function validarItens(itens, ramo = { noPromo: false }) {
  if (!itens.length) return 'quiz.itens.min'
  if (itens.length > MAX_ITENS) return 'quiz.itens.max'
  if (itens.some((i) => { const n = String(i.nome ?? '').trim(); return n.length < 2 || n.length > 80 })) return 'quiz.itens.nome'
  if (ramo.noPromo && itens.some((i) => temPromocao(`${i.nome} ${i.descricao ?? ''}`))) return 'quiz.itens.promo'
  if (!ramo.noPromo) {
    for (const i of itens) {
      const normal = precoDoTexto(i.precoTexto), promo = precoDoTexto(i.promoTexto)
      if ((String(i.precoTexto ?? '').trim() && normal === null) || (String(i.promoTexto ?? '').trim() && promo === null)) return 'quiz.itens.precoinvalido'
      if (promo !== null && normal === null) return 'quiz.itens.semnormal'
      if (promo !== null && promo > normal) return 'quiz.itens.promomaior'
    }
  }
  if (itens.some((i) => (i.fotos?.length ?? 0) > MAX_FOTOS)) return 'quiz.itens.fotos'
  return null
}

// "R$ 1.299,90" → 1299.9. Vazio, inválido ou ≤ 0 → null.
export function precoDoTexto(s) {
  let txt = String(s ?? '').replace(/R\$|\s/g, '')
  if (!txt) return null
  if (txt.includes(',')) txt = txt.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(txt)) txt = txt.replace(/\./g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(txt)) return null
  const v = Number(txt)
  return v > 0 ? v : null
}

// Vazio → null; válido → com @ na frente; inválido → undefined.
export function normalizarInsta(s) {
  const txt = String(s ?? '').trim()
  if (!txt) return null
  const semArroba = txt.replace(/^@/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(semArroba) ? `@${semArroba}` : undefined
}

// Reduz a foto no aparelho antes de enviar (spec §6). Rejeita se o navegador não abrir o arquivo.
export async function reduzirFoto(arquivo, maximo, tipo) {
  const imagem = await createImageBitmap(arquivo)
  const { largura, altura } = medidaReduzida(imagem.width, imagem.height, maximo)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  canvas.getContext('2d').drawImage(imagem, 0, 0, largura, altura)
  imagem.close()
  return new Promise((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error('toBlob falhou'))), tipo, 0.85))
}

export async function carregarNegocio(supabase, uid) {
  const [n, p] = await Promise.all([
    supabase.from('negocios').select('nome, insta, assinatura, tom, horario, cor1, cor2, logo_path')
      .eq('cliente_id', uid).maybeSingle(),
    supabase.from('produtos').select('id, nome, descricao, preco, preco_promo, fotos, foto_path').eq('cliente_id', uid).order('ordem'),
  ])
  if (n.error) throw n.error
  if (p.error) throw p.error
  const produtos = (p.data ?? []).map((x) => ({
    ...x, fotos: x.fotos?.length ? x.fotos : x.foto_path ? [x.foto_path] : [],
  }))
  return { negocio: n.data, produtos }
}

// Análise das fotos feita pela IA: Map path -> { serve, motivo }. Sem análise (ou erro), mapa vazio: todas servem.
export async function carregarFotosInfo(supabase, uid) {
  try {
    const { data, error } = await supabase.from('fotos_ia').select('path, serve, motivo').eq('cliente_id', uid)
    if (error) throw error
    return new Map((data ?? []).map((x) => [x.path, { serve: x.serve, motivo: x.motivo }]))
  } catch (e) {
    console.error(e)
    return new Map()
  }
}

// Funções de Storage compartilhadas pelas duas gravações.
function enviadorDeArquivos(supabase) {
  const marcas = supabase.storage.from('marcas')
  const enviar = async (caminho, blob, tipo) => {
    const { error } = await marcas.upload(caminho, blob, { upsert: true, contentType: tipo })
    if (error) throw error
    return caminho
  }
  return { marcas, enviar }
}

// dados: { nome, insta, assinatura, tom, horario, cor1, cor2, logo_path, logoBlob? }
// Grava só a linha de `negocios`; produtos não são tocados.
export async function salvarDadosNegocio(supabase, uid, dados) {
  const { enviar } = enviadorDeArquivos(supabase)
  const logo_path = dados.logoBlob ? await enviar(`${uid}/logo.png`, dados.logoBlob, 'image/png') : dados.logo_path ?? null
  if (dados.logoBlob) esquecerImagem(`${uid}/logo.png`) // mesmo caminho, logo novo: o cache não pode devolver o antigo
  const r1 = await supabase.from('negocios').upsert({
    cliente_id: uid, nome: dados.nome.trim(), insta: dados.insta, assinatura: dados.assinatura, tom: dados.tom,
    horario: dados.horario, cor1: dados.cor1, cor2: dados.cor2, logo_path, atualizado_em: new Date().toISOString(),
  })
  if (r1.error) throw r1.error
}

// itens: [{ id, nome, descricao, preco, preco_promo, fotos: [{ path } | { arquivo, nome }] }] — id já gerado no aparelho.
// opcoes.reduzir: redutor de fotos (troca-se nos testes, onde não há canvas).
// Itens do quiz (textos de preço) no formato gravado; ramos noPromo não têm preço.
export function itensParaSalvar(itens, ramo) {
  return itens.map((i) => {
    const preco = ramo.noPromo ? null : precoDoTexto(i.precoTexto)
    return { id: i.id, nome: i.nome, descricao: i.descricao, preco,
      preco_promo: ramo.noPromo ? null : (preco ? precoDoTexto(i.promoTexto) : null), fotos: i.fotos }
  })
}

export async function salvarItens(supabase, uid, itens, aoProgredir, opcoes = {}) {
  const reduzir = opcoes.reduzir ?? ((arquivo) => reduzirFoto(arquivo, FOTO_MAX, 'image/jpeg'))
  const { marcas, enviar } = enviadorDeArquivos(supabase)

  const { data: antigos, error: e2 } = await supabase.from('produtos').select('id, foto_path, fotos').eq('cliente_id', uid)
  if (e2) throw e2
  const pathsDe = (a) => [...new Set([...(a.fotos ?? []), ...(a.foto_path ? [a.foto_path] : [])])]
  // fotos ainda usadas por posts (via "Trocar imagem") não saem do Storage
  const { data: dePosts, error: e4 } = await supabase.from('posts').select('foto_path').not('foto_path', 'is', null)
  const emUso = new Set((dePosts ?? []).map((x) => x.foto_path))
  if (e4) console.error(e4) // sem saber o que os posts usam, não apaga nada do Storage
  const limpar = async (paths) => {
    if (e4) return
    const lista = paths.filter((p) => !emUso.has(p))
    if (lista.length) {
      await marcas.remove(lista) // melhor esforço
      try { await supabase.from('fotos_ia').delete().in('path', lista) } catch { /* melhor esforço */ }
    }
  }
  const ficam = new Set(itens.map((i) => i.id))
  const sair = antigos.filter((a) => !ficam.has(a.id))
  if (sair.length) {
    const { error } = await supabase.from('produtos').delete().in('id', sair.map((a) => a.id))
    if (error) throw error
    await limpar(sair.flatMap((a) => [`${uid}/produtos/${a.id}.jpg`, ...pathsDe(a)]))
  }

  const total = itens.reduce((n, i) => n + i.fotos.filter((f) => f.arquivo).length, 0)
  let feitas = 0
  const enviadas = []
  const linhas = []
  try {
    for (const [ordem, i] of itens.entries()) {
      const fotos = []
      for (const f of i.fotos) {
        if (f.arquivo) {
          const blob = await reduzir(f.arquivo)
          const caminho = await enviar(`${uid}/produtos/${i.id}/${crypto.randomUUID()}.jpg`, blob, 'image/jpeg')
          enviadas.push(caminho)
          fotos.push(caminho)
          aoProgredir?.(++feitas, total)
        } else fotos.push(f.path)
      }
      const preco = i.preco ?? null
      linhas.push({ id: i.id, cliente_id: uid, nome: i.nome.trim(), descricao: i.descricao?.trim() || null,
        preco, preco_promo: preco === null ? null : i.preco_promo ?? null, fotos, foto_path: fotos[0] ?? null, ordem })
    }
    const r3 = await supabase.from('produtos').upsert(linhas)
    if (r3.error) throw r3.error
  } catch (e) {
    if (enviadas.length) { try { await marcas.remove(enviadas) } catch { /* melhor esforço */ } }
    throw e
  }

  // fotos que o item tinha e não tem mais
  const novos = new Map(linhas.map((l) => [l.id, new Set(l.fotos)]))
  await limpar(antigos.filter((a) => novos.has(a.id)).flatMap((a) => pathsDe(a).filter((p) => !novos.get(a.id).has(p))))

  // A IA descreve as fotos novas em segundo plano: salvar nunca espera por isso.
  const todas = [...new Set(linhas.flatMap((l) => l.fotos))].slice(0, 30)
  if (todas.length && supabase.functions?.invoke) {
    Promise.resolve(supabase.functions.invoke('descrever-fotos', { body: { paths: todas } }))
      .then(() => new Promise((ok) => setTimeout(ok, 4000))) // dá tempo de as análises chegarem ao banco
      .then(() => carregarFotosInfo(supabase, uid))
      .then((info) => opcoes.aoFotosInfo?.(info))
      .catch((e) => console.error(e))
  }
}

export async function salvarNegocio(supabase, uid, dados, itens, aoProgredir, opcoes = {}) {
  await salvarDadosNegocio(supabase, uid, dados)
  await salvarItens(supabase, uid, itens, aoProgredir, opcoes)
}
