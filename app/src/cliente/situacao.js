// Regras puras do calendário e do post (sem DOM).

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// "2026-11-04" -> "4 de novembro".
export function diaPorExtenso(data) {
  const [, m, d] = data.split('-').map(Number)
  return `${d} de ${MESES[m - 1]}`
}

// Chave do formato mostrado ("Carrossel", "Stories"…): no feed e no vídeo é o formato; nos outros, o tipo.
export const chaveFormato = (p) => (p.tipo === 'feed' || p.tipo === 'video' ? p.formato : p.tipo)

// Situação de um post para o calendário. "reprovado" aparece na tela como "Descartado".
export function situacaoDoPost(post) {
  if (post.postado_em) return 'postado'
  if (post.estado === 'reprovado') return 'reprovado'
  if (post.estado === 'aprovado') return 'aprovado'
  return 'pendente'
}

// Cor do dia: postado só se todos os não descartados foram postados; depois pendente,
// reprovado (descartado) e aprovado. null = dia sem post.
export function corDoDia(posts) {
  if (!posts.length) return null
  const sit = posts.map(situacaoDoPost)
  const ativos = sit.filter((x) => x !== 'reprovado')
  if (ativos.length && ativos.every((x) => x === 'postado')) return 'postado'
  if (sit.includes('pendente')) return 'pendente'
  if (sit.includes('reprovado')) return 'reprovado'
  return 'aprovado'
}

export function resumoDoMes(posts) {
  const r = { postado: 0, aprovado: 0, pendente: 0, reprovado: 0 }
  for (const p of posts) r[situacaoDoPost(p)]++
  return r
}

// Dia que abre selecionado: hoje se for do mês; senão o primeiro dia com post; senão o dia 1.
export function diaInicial(anoMes, hoje, posts) {
  if (hoje.startsWith(anoMes)) return hoje
  const datas = posts.map((p) => p.data).sort()
  return datas[0] ?? `${anoMes}-01`
}

// Dias do mês em semanas de domingo a sábado; null antes do dia 1 e depois do último dia.
export function gradeDoMes(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number)
  const antes = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay()
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const dias = Array(antes).fill(null)
  for (let d = 1; d <= total; d++) dias.push(`${anoMes}-${String(d).padStart(2, '0')}`)
  while (dias.length % 7) dias.push(null)
  return dias
}

// Fotos de um item: as do banco, ou a foto única de antes (foto_path) quando não houver lista.
export const fotosDoProduto = (p, fotosInfo) => fotosQueServem(p.fotos?.length ? p.fotos : p.foto_path ? [p.foto_path] : [], fotosInfo)

// Tira as fotos que a análise reprovou (serve === false). fotosInfo: Map path -> { serve, motivo }; foto sem análise serve.
export const fotosQueServem = (paths, fotosInfo) => paths.filter((p) => fotosInfo?.get(p)?.serve !== false)

// Andamento dos posts escritos pela IA, de hoje em diante: feitos de total, e se ainda há fila.
export function progressoIA(posts, hoje) {
  const nossos = posts.filter((p) => p.data >= hoje && ['fila', 'trabalhando', 'pronto', 'desistiu'].includes(p.ia_estado))
  return {
    feitos: nossos.filter((p) => p.ia_estado === 'pronto' || p.ia_estado === 'desistiu').length,
    total: nossos.length,
    ativo: nossos.some((p) => p.ia_estado === 'fila' || p.ia_estado === 'trabalhando'),
  }
}

// Todas as fotos de todos os itens, na ordem dos itens e sem repetir.
export const todasAsFotos = (produtos, fotosInfo) => [...new Set(produtos.flatMap((p) => fotosDoProduto(p, fotosInfo)))]

// Foto do post (null = arte só com texto):
// 1. sem_foto em ramo só de texto -> nenhuma; 2. a foto escolhida para o post (mesmo reprovada pela IA:
//    a escolha do cliente vale; o aviso aparece em Meu negócio);
// 3. post de um item -> só as fotos DELE, revezando pela ordem do post (nunca a de outro item);
// 4. post geral (fora dos ramos só de texto) -> reveza todas as fotos pela ordem do post;
//    com uma foto só, alterna foto e só texto, para não repetir a mesma foto o mês todo.
export function fotoDoPost(post, produtos, ramo, fotosInfo) {
  const soTexto = Boolean(ramo?.textOnly)
  if (post.sem_foto && soTexto) return null
  if (post.foto_path) return post.foto_path
  const produto = post.produto_id ? produtos.find((p) => p.id === post.produto_id) : null
  if (produto) {
    const f = fotosDoProduto(produto, fotosInfo)
    return f.length ? f[(post.ordem ?? 0) % f.length] : null
  }
  if (soTexto) return null
  const fotos = todasAsFotos(produtos, fotosInfo)
  if (!fotos.length) return null
  const ciclo = fotos.length === 1 ? [fotos[0], null] : fotos
  return ciclo[(post.ordem ?? 0) % ciclo.length]
}

// Fotos para a montagem de vídeo: as do item a partir da foto da vez, até `max`; post geral -> só a foto da vez.
export function fotosDoPost(post, produtos, ramo, max = 4, fotosInfo) {
  const primeira = fotoDoPost(post, produtos, ramo, fotosInfo)
  if (!primeira) return []
  const produto = post.produto_id ? produtos.find((p) => p.id === post.produto_id) : null
  const f = produto ? fotosDoProduto(produto, fotosInfo) : []
  const i = f.indexOf(primeira)
  if (i < 0) return [primeira]
  return [...f.slice(i), ...f.slice(0, i)].slice(0, max)
}

// Quantos itens estão sem foto (para o aviso do calendário). Nos ramos só de texto a foto é opcional.
export function servicosSemFoto(produtos, ramo, fotosInfo) {
  if (ramo?.textOnly) return 0
  return produtos.filter((p) => !fotosDoProduto(p, fotosInfo).length).length
}

// 2199 -> 'R$ 2.199'; 1999.9 -> 'R$ 1.999,90' (centavos só quando houver).
function dinheiro(v) {
  const n = Number(v)
  const temCentavos = Math.round(n * 100) % 100 !== 0
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: temCentavos ? 2 : 0, maximumFractionDigits: temCentavos ? 2 : 0 }).replace(/ /g, ' ')
}

// Preço do selo da arte: null sem preço ou nos ramos que não fazem promoção.
function precoDaArte(post, ramo) {
  if (ramo?.noPromo || post.preco_por == null) return null
  return { de: post.preco_de != null ? dinheiro(post.preco_de) : null, por: dinheiro(post.preco_por) }
}

// Textos da arte. Legenda: gancho (1º), meio (2º) e convite (penúltimo; o último se houver até 3).
export function pecasDaArte(post, negocio, ramo) {
  const par = (post.legenda ?? '').split(/\n\n+/).map((x) => x.trim()).filter(Boolean)
  const convite = par.length < 2 ? '' : par.length <= 3 ? par[par.length - 1] : par[par.length - 2]
  const modo = negocio.assinatura
  const insta = (negocio.insta ?? '').trim()
  return {
    rotulo: (negocio.nome ?? '').toUpperCase(),
    titulo: post.titulo,
    gancho: par[0] ?? '',
    meio: par.length >= 3 ? par[1] : '',
    convite,
    preco: precoDaArte(post, ramo),
    assinatura: {
      texto: modo !== 'logo' && insta ? insta : null,
      logo: modo === 'logo' || modo === 'ambos',
    },
  }
}

// Mudança a gravar no post para cada ação. 'agora' vira a hora do servidor ao gravar.
export function proximoEstado(post, acao) {
  switch (acao) {
    case 'aprovar': return { estado: 'aprovado' }
    case 'desaprovar':
    case 'desfazer': return { estado: 'gerado' }
    case 'descartar': return { estado: 'reprovado' }
    case 'postei': return { estado: 'aprovado', postado_em: new Date().toISOString() }
    case 'despostar': return { postado_em: null }
    default: throw new Error(`ação desconhecida: ${acao}`)
  }
}
