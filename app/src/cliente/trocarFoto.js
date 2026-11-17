// Trocar imagem do post: a janela com as fotos dos produtos, "Enviar outra foto" e "Sem foto",
// a gravação da escolha (foto nova: reduz, envia ao Storage e grava o caminho) e, depois, a legenda reescrita
// pela IA para a foto nova (função reescrever-post).
import { t } from '../textos.js'
import { el, aviso } from '../comum.js'
import { fotoDoPost, fotosDoProduto, todasAsFotos } from './situacao.js'
import { reduzirFoto, FOTO_MAX } from './negocio.js'
import { gravarMudanca, postOcupado } from './acoesPost.js'
import { carregarImagem, prenderImagens, esquecerImagem } from '../artes/imagens.js'

const MINI = 96 // px do quadrado de cada foto na grade (toque bem maior que 48 px)

// A foto enviada para um post fica na pasta do cliente (o banco só aceita foto_path dentro dela).
export const caminhoDaFotoDoPost = (uid, postId) => `${uid}/posts/${postId}.jpg`

// As fotos que o cliente pode escolher: a que ele enviou para o post (se houver) e as dos produtos.
// `atual` marca a que a arte usa agora (a mesma regra de fotoDoPost). semFoto: só nos ramos textOnly.
export function opcoesDeFoto(produtos, ramo, post, fotosInfo) {
  const atual = fotoDoPost(post, produtos, ramo, fotosInfo)
  const paths = [...new Set([post.foto_path, ...todasAsFotos(produtos, fotosInfo)].filter(Boolean))]
  return {
    fotos: paths.map((path) => ({ path, atual: path === atual })),
    semFoto: Boolean(ramo?.textOnly),
  }
}

// O quadradinho da foto, cortado no centro.
async function desenharMini(supabase, path, caixa) {
  const soltar = prenderImagens([path])
  try {
    const img = await carregarImagem(supabase, path)
    if (!img || !caixa.isConnected) return
    const c = el('canvas', { width: String(MINI * 2), height: String(MINI * 2), 'aria-hidden': 'true' })
    const lado = Math.min(img.width, img.height)
    c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, c.width, c.height)
    caixa.prepend(c)
  } finally {
    soltar()
  }
}

// Abre a janela por cima da tela do post. aoEscolher recebe:
// { foto_path } (uma das fotos), { arquivo } (foto nova da galeria/câmera) ou { sem_foto: true }.
// Tocar na foto atual só fecha a janela.
export function abrirTrocaDeFoto({ supabase, post, produtos, ramo, fotosInfo, aoEscolher }) {
  const { fotos, semFoto } = opcoesDeFoto(produtos ?? [], ramo, post, fotosInfo)
  const nomePorPath = new Map((produtos ?? []).flatMap((p) => fotosDoProduto(p, fotosInfo).map((f) => [f, p.nome])))
  const ids = { titulo: 'trocar-foto-titulo', dica: 'trocar-foto-dica', semfoto: 'trocar-foto-sem' }
  const semFotoAtual = semFoto && post.sem_foto

  const dialogo = el('dialog', { class: 'dialogo trocar-foto', 'aria-labelledby': ids.titulo, 'aria-describedby': ids.dica })
  const escolher = (escolha) => { dialogo.close(); aoEscolher(escolha) }

  const botoes = fotos.map(({ path, atual }) => {
    const nome = nomePorPath.get(path)
    const b = el('button', {
      type: 'button', class: atual ? 'foto-opcao atual' : 'foto-opcao', 'aria-pressed': String(atual),
      'aria-label': nome ? t('foto.opcao', { nome }) : t('foto.opcao.enviada'),
      onclick: () => (atual ? dialogo.close() : escolher({ foto_path: path })),
    }, atual ? el('span', { class: 'selo-atual', 'aria-hidden': 'true', texto: t('foto.atual') }) : null)
    desenharMini(supabase, path, b).catch((e) => console.error(e)) // sem a imagem, fica o quadrado vazio
    return b
  })

  // Galeria ou câmera: o celular oferece as duas para accept="image/*".
  const entrada = el('input', { type: 'file', accept: 'image/*', hidden: true })
  entrada.addEventListener('change', () => {
    const arquivo = entrada.files?.[0]
    if (arquivo) escolher({ arquivo })
  })
  const enviar = el('button', { type: 'button', texto: t('foto.enviar'), onclick: () => entrada.click() })
  const sem = semFoto
    ? el('div', { class: 'opcao' },
      el('button', {
        type: 'button', class: 'secundario', 'aria-pressed': String(semFotoAtual), 'aria-describedby': ids.semfoto,
        texto: semFotoAtual ? `${t('foto.semfoto')} ${t('foto.atual')}` : t('foto.semfoto'),
        onclick: () => (semFotoAtual ? dialogo.close() : escolher({ sem_foto: true })),
      }),
      el('p', { id: ids.semfoto, class: 'pequeno muted', texto: t('foto.semfoto.dica') }))
    : null
  const cancelar = el('button', { type: 'button', class: 'secundario', texto: t('foto.cancelar'), onclick: () => dialogo.close() })

  dialogo.append(
    el('h2', { id: ids.titulo, texto: t('foto.titulo') }),
    el('p', { id: ids.dica, class: 'pequeno muted', texto: t('foto.dica') }),
    ...(botoes.length ? [el('div', { class: 'grade-fotos' }, botoes)] : []),
    el('div', { class: 'opcao' }, enviar, entrada),
    ...(sem ? [sem] : []),
    cancelar)
  dialogo.addEventListener('close', () => dialogo.remove())
  document.body.append(dialogo)
  dialogo.showModal()
  ;(botoes.find((b) => b.classList.contains('atual')) ?? botoes[0] ?? enviar).focus()
  return dialogo
}

const enviando = new Set() // posts com uma foto nova ainda subindo

// Grava a escolha feita na janela. aoMudar redesenha (chamado na hora e, se falhar, ao voltar).
// Foto nova: reduz no aparelho, envia para ${uid}/posts/${id}.jpg e esquece a imagem velha do cache.
// Depois de gravar, a IA reescreve a legenda para a foto (reescreverLegenda: aoEscrevendo e aoMudarTexto).
// Devolve true quando a foto gravou.
// fotosInfo (o Map de ctx.fotosInfo): a análise da foto antiga do mesmo caminho sai dele.
export async function gravarEscolhaDeFoto({ supabase, uid, post, escolha, aoMudar, aoEscrevendo, aoMudarTexto, fotosInfo }) {
  const ok = await gravarFoto({ supabase, uid, post, escolha, aoMudar, fotosInfo })
  if (ok) await reescreverLegenda({ supabase, post, aoEscrevendo, aoMudarTexto })
  return ok
}

// Só o texto que o cliente ainda não aceitou é reescrito (a mesma regra da função reescrever-post).
export const podeReescrever = (post) => ['gerado', 'reprovado'].includes(post.estado) && !post.postado_em

// A IA reescreve a legenda para a foto atual. aoEscrevendo(true/false) marca a espera ("Escrevendo…");
// aoMudarTexto é chamado quando o post recebeu o texto novo. Sem texto novo (IA indisponível, sem conexão…)
// fica tudo como estava, em silêncio: a foto já trocou. Devolve true se o texto mudou.
export async function reescreverLegenda({ supabase, post, aoEscrevendo, aoMudarTexto }) {
  if (!podeReescrever(post)) return false
  const legendaAntes = post.legenda
  aoEscrevendo?.(true)
  try {
    const { data, error } = await supabase.functions.invoke('reescrever-post', { body: { post_id: post.id } })
    if (error) { console.error(error); return false }
    // o texto mudou no aparelho enquanto a IA escrevia (ex.: Gerar outro): o mais novo fica
    if (!data?.post || post.legenda !== legendaAntes) return false
    Object.assign(post, data.post)
    aoMudarTexto?.()
    return true
  } catch (e) {
    console.error(e)
    return false
  } finally {
    aoEscrevendo?.(false)
  }
}

// Foto nova no mesmo caminho: a análise da foto anterior (fotos_ia) não vale mais. Apaga a linha (o cliente pode
// apagar as dele) e pede uma análise nova em segundo plano (spec §7 item 10). Nada disso impede a troca.
async function esquecerAnalise(supabase, caminho, fotosInfo) {
  fotosInfo?.delete?.(caminho)
  try {
    const { error } = await supabase.from('fotos_ia').delete().eq('path', caminho)
    if (error) console.error(error)
  } catch (e) {
    console.error(e)
  }
}
function pedirAnalise(supabase, caminho) {
  if (!supabase.functions?.invoke) return
  Promise.resolve(supabase.functions.invoke('descrever-fotos', { body: { paths: [caminho] } }))
    .catch((e) => console.error(e))
}

async function gravarFoto({ supabase, uid, post, escolha, aoMudar, fotosInfo }) {
  // Com outra gravação do post em andamento, gravarMudanca ignoraria esta: avisa em vez de ficar em silêncio.
  const gravar = (mudanca) => {
    if (postOcupado(post)) { aviso(t('post.aguarde')); return false }
    return gravarMudanca({ supabase, post, mudanca, aoMudar })
  }
  if (escolha.sem_foto) return gravar({ sem_foto: true })
  if (!escolha.arquivo) return gravar({ foto_path: escolha.foto_path, sem_foto: false })

  if (enviando.has(post.id) || postOcupado(post)) { aviso(t('post.aguarde')); return false }
  enviando.add(post.id)
  try {
    let blob
    try {
      blob = await reduzirFoto(escolha.arquivo, FOTO_MAX, 'image/jpeg')
    } catch (e) {
      console.error(e)
      aviso(t('foto.naoabriu')) // a foto anterior continua
      return false
    }
    aviso(t('foto.enviando'))
    const caminho = caminhoDaFotoDoPost(uid, post.id)
    const { error } = await supabase.storage.from('marcas').upload(caminho, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) {
      console.error(error)
      aviso(t('erro.conexao'))
      return false
    }
    esquecerImagem(caminho) // mesmo caminho, imagem nova: o cache não pode devolver a antiga
    await esquecerAnalise(supabase, caminho, fotosInfo)
    const ok = await gravar({ foto_path: caminho, sem_foto: false })
    pedirAnalise(supabase, caminho) // a foto já está no Storage: vale analisar mesmo se o post não gravou
    return ok
  } finally {
    enviando.delete(post.id)
  }
}
