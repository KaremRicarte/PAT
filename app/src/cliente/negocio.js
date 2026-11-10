// Dados do negócio do cliente: leitura, gravação e preparo das fotos.
// O cliente do Supabase vem por parâmetro, para as funções puras poderem ser testadas sem rede.
import { temPromocao } from '../../../supabase/functions/_shared/modelos/validar.ts'

export const MAX_ITENS = 12
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
  return null
}

// "R$ 1.299,90" → 1299.9. Vazio, inválido ou ≤ 0 → null.
export function precoDoTexto(s) {
  let txt = String(s ?? '').replace(/R\$|\s/g, '')
  if (!txt) return null
  if (txt.includes(',')) txt = txt.replace(/\./g, '').replace(',', '.')
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
    supabase.from('produtos').select('id, nome, descricao, preco, foto_path').eq('cliente_id', uid).order('ordem'),
  ])
  if (n.error) throw n.error
  if (p.error) throw p.error
  return { negocio: n.data, produtos: p.data ?? [] }
}

// dados: { nome, insta, assinatura, tom, horario, cor1, cor2, logo_path, logoBlob? }
// itens: [{ id, nome, descricao, preco, foto_path, fotoBlob? }] — id já gerado no aparelho.
export async function salvarNegocio(supabase, uid, dados, itens) {
  const enviar = async (caminho, blob, tipo) => {
    const { error } = await supabase.storage.from('marcas').upload(caminho, blob, { upsert: true, contentType: tipo })
    if (error) throw error
    return caminho
  }

  const logo_path = dados.logoBlob ? await enviar(`${uid}/logo.png`, dados.logoBlob, 'image/png') : dados.logo_path ?? null
  const r1 = await supabase.from('negocios').upsert({
    cliente_id: uid, nome: dados.nome.trim(), insta: dados.insta, assinatura: dados.assinatura, tom: dados.tom,
    horario: dados.horario, cor1: dados.cor1, cor2: dados.cor2, logo_path, atualizado_em: new Date().toISOString(),
  })
  if (r1.error) throw r1.error

  const { data: antigos, error: e2 } = await supabase.from('produtos').select('id').eq('cliente_id', uid)
  if (e2) throw e2
  const ficam = new Set(itens.map((i) => i.id))
  const sair = antigos.map((a) => a.id).filter((id) => !ficam.has(id))
  if (sair.length) {
    const { error } = await supabase.from('produtos').delete().in('id', sair)
    if (error) throw error
    await supabase.storage.from('marcas').remove(sair.map((id) => `${uid}/produtos/${id}.jpg`)) // melhor esforço
  }

  const linhas = []
  for (const [ordem, i] of itens.entries()) {
    const foto_path = i.fotoBlob ? await enviar(`${uid}/produtos/${i.id}.jpg`, i.fotoBlob, 'image/jpeg') : i.foto_path ?? null
    linhas.push({ id: i.id, cliente_id: uid, nome: i.nome.trim(), descricao: i.descricao?.trim() || null,
      preco: i.preco ?? null, foto_path, ordem })
  }
  const r3 = await supabase.from('produtos').upsert(linhas)
  if (r3.error) throw r3.error
}
