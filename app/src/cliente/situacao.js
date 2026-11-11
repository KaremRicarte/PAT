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

// Foto do post: sem_foto em ramo só de texto -> nenhuma; senão a do post, a do produto
// e, fora dos ramos só de texto, a primeira foto de produto.
export function fotoDoPost(post, produtos, ramo) {
  const soTexto = Boolean(ramo?.textOnly)
  if (post.sem_foto && soTexto) return null
  if (post.foto_path) return post.foto_path
  const doProduto = produtos.find((p) => p.id === post.produto_id)?.foto_path
  if (doProduto) return doProduto
  if (soTexto) return null
  return produtos.find((p) => p.foto_path)?.foto_path ?? null
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
