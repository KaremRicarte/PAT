// Trocar imagem do post: a janela com as fotos dos produtos, "Enviar outra foto" e "Sem foto",
// e a gravação da escolha (foto nova: reduz, envia ao Storage e grava o caminho).
import { t } from '../textos.js'
import { el, aviso } from '../comum.js'
import { fotoDoPost } from './situacao.js'
import { reduzirFoto, FOTO_MAX } from './negocio.js'
import { gravarMudanca } from './acoesPost.js'
import { carregarImagem, prenderImagens, esquecerImagem } from '../artes/imagens.js'

const MINI = 96 // px do quadrado de cada foto na grade (toque bem maior que 48 px)

// A foto enviada para um post fica na pasta do cliente (o banco só aceita foto_path dentro dela).
export const caminhoDaFotoDoPost = (uid, postId) => `${uid}/posts/${postId}.jpg`

// As fotos que o cliente pode escolher: a que ele enviou para o post (se houver) e as dos produtos.
// `atual` marca a que a arte usa agora (a mesma regra de fotoDoPost). semFoto: só nos ramos textOnly.
export function opcoesDeFoto(produtos, ramo, post) {
  const atual = fotoDoPost(post, produtos, ramo)
  const paths = [...new Set([post.foto_path, ...produtos.map((p) => p.foto_path)].filter(Boolean))]
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
export function abrirTrocaDeFoto({ supabase, post, produtos, ramo, aoEscolher }) {
  const { fotos, semFoto } = opcoesDeFoto(produtos ?? [], ramo, post)
  const nomePorPath = new Map((produtos ?? []).filter((p) => p.foto_path).map((p) => [p.foto_path, p.nome]))
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
// Devolve true quando gravou.
export async function gravarEscolhaDeFoto({ supabase, uid, post, escolha, aoMudar }) {
  if (escolha.sem_foto) return gravarMudanca({ supabase, post, mudanca: { sem_foto: true }, aoMudar })
  if (!escolha.arquivo) return gravarMudanca({ supabase, post, mudanca: { foto_path: escolha.foto_path, sem_foto: false }, aoMudar })

  if (enviando.has(post.id)) { aviso(t('post.aguarde')); return false }
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
    return await gravarMudanca({ supabase, post, mudanca: { foto_path: caminho, sem_foto: false }, aoMudar })
  } finally {
    enviando.delete(post.id)
  }
}
