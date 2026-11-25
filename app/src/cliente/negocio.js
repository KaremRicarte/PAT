// Dados do negócio do cliente: leitura, gravação e preparo das fotos.
// O cliente do Supabase vem por parâmetro, para as funções puras poderem ser testadas sem rede.
import { invocar } from '../comum.js'
import { temPromocao } from '../../../supabase/functions/_shared/modelos/validar.ts'

export const MAX_ITENS = 20
export const MAX_FOTOS = 12
export const MAX_FOTOS_NEGOCIO = 30 // "Minhas fotos" (spec §3.7)
export const FOTO_MAX = 1600 // lado maior das fotos, em px
export const LOGO_MAX = 800

// Nome para comparar itens e arquivos: sem acentos, maiúsculas, espaços nem símbolos ("October Fest" = "october_fest").
export function normalizarNome(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Grupos de posições (0, 1, …) dos itens com o mesmo nome depois de normalizar ("October Fest" = "october fest").
export function itensRepetidos(itens) {
  const grupos = new Map()
  itens.forEach((i, idx) => {
    const k = normalizarNome(i.nome)
    if (k) grupos.set(k, [...(grupos.get(k) ?? []), idx])
  })
  return [...grupos.values()].filter((g) => g.length > 1)
}

// Texto que diz quais itens se repetem: "October Fest" (Pacote 2) e "october fest" (Pacote 4); …
export function textoDosRepetidos(itens, rotulo) {
  return itensRepetidos(itens)
    .map((g) => g.map((idx) => `"${String(itens[idx].nome).trim()}" (${rotulo} ${idx + 1})`).join(' e '))
    .join('; ')
}

// Nova medida mantendo a proporção; nunca aumenta a imagem.
export function medidaReduzida(largura, altura, maximo) {
  const fator = Math.min(1, maximo / Math.max(largura, altura))
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) }
}

// Devolve a chave de texto do primeiro problema, ou null se a lista está boa.
// Em ramos com regras de conselho (noPromo), nome e descrição não podem falar de preço/promoção.
import { normalizarWhatsApp } from '../contato.js'
import { pacoteParaGravar, validarPacote } from '../../../supabase/functions/_shared/modelos/pacote.ts'

export function validarItens(itens, ramo = { noPromo: false }) {
  if (!itens.length) return 'quiz.itens.min'
  if (itens.length > MAX_ITENS) return 'quiz.itens.max'
  if (itens.some((i) => { const n = String(i.nome ?? '').trim(); return n.length < 2 || n.length > 80 })) return 'quiz.itens.nome'
  if (itensRepetidos(itens).length) return 'quiz.itens.repetido'
  if (ramo.noPromo && itens.some((i) => temPromocao(`${i.nome} ${i.descricao ?? ''}`))) return 'quiz.itens.promo'
  if (!ramo.noPromo) {
    for (const i of itens) {
      const normal = precoDoTexto(i.precoTexto), promo = precoDoTexto(i.promoTexto)
      if ((String(i.precoTexto ?? '').trim() && normal === null) || (String(i.promoTexto ?? '').trim() && promo === null)) return 'quiz.itens.precoinvalido'
      if (promo !== null && normal === null) return 'quiz.itens.semnormal'
      if (promo !== null && promo > normal) return 'quiz.itens.promomaior'
      // caixinha da data marcada: precisa de um dia escolhido (o preço é opcional; sem preço, o post sai sem valor)
      if (i.promoData != null && !/^\d{4}-\d{2}-\d{2}$/.test(i.promoData)) return 'quiz.itens.datainvalida'
    }
  }
  // Turismo: detalhes do pacote (datas, parcelas, Pix)
  if (ramo.id === 'turismo') {
    for (const i of itens) { const k = validarPacote(i.pacote); if (k) return k }
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
    supabase.from('negocios').select('nome, insta, whatsapp, assinatura, tom, horario, cor1, cor2, logo_path, fotos, pronto')
      .eq('cliente_id', uid).maybeSingle(),
    supabase.from('produtos').select('id, nome, descricao, preco, preco_promo, promo_data, ocultar_preco, pacote, fotos, foto_path').eq('cliente_id', uid).order('ordem'),
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

// dados: { assinatura, tom, horario, cor1, cor2 }
// Grava só as escolhas do cliente na linha de `negocios` (que a administração criou) e marca o
// questionário como respondido. Nome, Instagram e logo são da administração: não vão aqui.
export async function salvarDadosNegocio(supabase, uid, dados) {
  const r1 = await supabase.from('negocios').update({
    // WhatsApp da empresa (opcional): só dígitos; a tela já validou
    whatsapp: normalizarWhatsApp(dados.whatsapp) ?? null,
    assinatura: dados.assinatura, tom: dados.tom, horario: dados.horario, cor1: dados.cor1, cor2: dados.cor2,
    pronto: true, atualizado_em: new Date().toISOString(),
  }).eq('cliente_id', uid).select('cliente_id')
  if (r1.error) throw r1.error
  if (!r1.data?.length) throw new Error('negócio não encontrado')
}

// itens: [{ id, nome, descricao, preco, preco_promo, fotos: [{ path } | { arquivo, nome }] }] — id já gerado no aparelho.
// opcoes.reduzir: redutor de fotos (troca-se nos testes, onde não há canvas).
// Itens do quiz (textos de preço) no formato gravado; ramos noPromo não têm preço.
export function itensParaSalvar(itens, ramo) {
  return itens.map((i) => {
    const preco = ramo.noPromo ? null : precoDoTexto(i.precoTexto)
    const preco_promo = ramo.noPromo ? null : (preco ? precoDoTexto(i.promoTexto) : null)
    // caixinha "Promoção só para uma data especial" (vale com ou sem preço; ramos noPromo não têm promoção)
    return { id: i.id, nome: i.nome, descricao: i.descricao, preco, preco_promo,
      promo_data: !ramo.noPromo && i.promoData ? i.promoData : null,
      // caixinha "Ocultar preço" (ramos noPromo não têm preço)
      ocultar_preco: !ramo.noPromo && Boolean(i.ocultarPreco),
      // detalhes do pacote de viagem (só Turismo)
      pacote: ramo.id === 'turismo' ? pacoteParaGravar(i.pacote) : null, fotos: i.fotos }
  })
}

export async function salvarItens(supabase, uid, itens, aoProgredir, opcoes = {}) {
  const reduzir = opcoes.reduzir ?? ((arquivo) => reduzirFoto(arquivo, FOTO_MAX, 'image/jpeg'))
  const { marcas, enviar } = enviadorDeArquivos(supabase)

  const { data: antigos, error: e2 } = await supabase.from('produtos').select('id, foto_path, fotos').eq('cliente_id', uid)
  if (e2) throw e2
  const pathsDe = (a) => [...new Set([...(a.fotos ?? []), ...(a.foto_path ? [a.foto_path] : [])])]
  const limpar = await limpadorDeStorage(supabase, marcas)
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
          // com resumo do conteúdo (importação), o nome do arquivo é o resumo: a mesma foto é reconhecida depois
          const caminho = await enviar(`${uid}/produtos/${i.id}/${f.hash ?? crypto.randomUUID()}.jpg`, blob, 'image/jpeg')
          // foto com hash: o mesmo arquivo pode já existir e estar em posts; numa falha, ele fica (nunca é apagado)
          if (!f.hash) enviadas.push(caminho)
          fotos.push(caminho)
          aoProgredir?.(++feitas, total)
        } else fotos.push(f.path)
      }
      const preco = i.preco ?? null
      linhas.push({ id: i.id, cliente_id: uid, nome: i.nome.trim(), descricao: i.descricao?.trim() || null,
        preco, preco_promo: preco === null ? null : i.preco_promo ?? null,
        promo_data: i.promo_data ?? null, ocultar_preco: i.ocultar_preco ?? false, pacote: i.pacote ?? null, fotos, foto_path: fotos[0] ?? null, ordem })
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

  descreverEmSegundoPlano(supabase, uid, linhas.flatMap((l) => l.fotos), opcoes)
}

// Apaga do Storage (e as análises da IA) as fotos que ninguém mais usa. Fotos ainda usadas por posts
// (via "Trocar imagem") ficam. Sem saber o que os posts usam, não apaga nada.
async function limpadorDeStorage(supabase, marcas) {
  const { data: dePosts, error } = await supabase.from('posts').select('foto_path').not('foto_path', 'is', null)
  const emUso = new Set((dePosts ?? []).map((x) => x.foto_path))
  if (error) console.error(error)
  return async (paths) => {
    if (error) return
    const lista = paths.filter((p) => !emUso.has(p))
    if (lista.length) {
      await marcas.remove(lista) // melhor esforço
      try { await supabase.from('fotos_ia').delete().in('path', lista) } catch { /* melhor esforço */ }
    }
  }
}

// A IA descreve as fotos em segundo plano: salvar nunca espera por isso.
function descreverEmSegundoPlano(supabase, uid, paths, opcoes) {
  const todas = [...new Set(paths)].slice(0, 30)
  if (todas.length && supabase.functions?.invoke) {
    Promise.resolve(invocar(supabase, 'descrever-fotos', { body: { paths: todas } }))
      .then(() => new Promise((ok) => setTimeout(ok, 4000))) // dá tempo de as análises chegarem ao banco
      .then(() => carregarFotosInfo(supabase, uid))
      .then((info) => opcoes.aoFotosInfo?.(info))
      .catch((e) => console.error(e))
  }
}

// "Minhas fotos": fotos: [{ path } | { arquivo, nome }] (até 30). Grava negocios.fotos; não mexe nos produtos.
export async function salvarFotosDoNegocio(supabase, uid, fotos, aoProgredir, opcoes = {}) {
  if (fotos.length > MAX_FOTOS_NEGOCIO) throw new Error('fotos demais')
  const reduzir = opcoes.reduzir ?? ((arquivo) => reduzirFoto(arquivo, FOTO_MAX, 'image/jpeg'))
  const { marcas, enviar } = enviadorDeArquivos(supabase)
  const { data: atual, error: e1 } = await supabase.from('negocios').select('fotos').eq('cliente_id', uid).maybeSingle()
  if (e1) throw e1
  const antigas = atual?.fotos ?? []
  const limpar = await limpadorDeStorage(supabase, marcas)

  const total = fotos.filter((f) => f.arquivo).length
  let feitas = 0
  const enviadas = []
  const caminhos = []
  try {
    for (const f of fotos) {
      if (f.arquivo) {
        const blob = await reduzir(f.arquivo)
        const caminho = await enviar(`${uid}/negocio/${crypto.randomUUID()}.jpg`, blob, 'image/jpeg')
        enviadas.push(caminho)
        caminhos.push(caminho)
        aoProgredir?.(++feitas, total)
      } else caminhos.push(f.path)
    }
    const r = await supabase.from('negocios').update({ fotos: caminhos, atualizado_em: new Date().toISOString() }).eq('cliente_id', uid)
    if (r.error) throw r.error
  } catch (e) {
    if (enviadas.length) { try { await marcas.remove(enviadas) } catch { /* melhor esforço */ } }
    throw e
  }
  const ficam = new Set(caminhos)
  await limpar(antigas.filter((p) => !ficam.has(p)))
  descreverEmSegundoPlano(supabase, uid, caminhos, opcoes)
}

export async function salvarNegocio(supabase, uid, dados, itens, aoProgredir, opcoes = {}) {
  await salvarDadosNegocio(supabase, uid, dados)
  await salvarItens(supabase, uid, itens, aoProgredir, opcoes)
}
