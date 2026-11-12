// Entregar ao aparelho os arquivos do post (imagens e vídeo).
// iPhone/iPad: compartilhamento (Web Share), cujo "Salvar imagem" leva às Fotos.
// Os outros, ou quando o compartilhamento falha: <a download>.
import { el } from '../comum.js'
import { modoDeSalvar } from './acoesPost.js'

const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms))

function salvar(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = el('a', { href: url, download: nome, hidden: true })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// Vários arquivos por <a download>, um de cada vez: alguns navegadores barram vários juntos.
export async function baixarArquivos(arquivos) {
  for (let i = 0; i < arquivos.length; i++) {
    if (i) await pausa(400)
    salvar(arquivos[i], arquivos[i].name)
  }
}

// 'compartilhar' no iPhone/iPad que compartilha arquivos; senão 'baixar'.
export function modoDoAparelho(nav = globalThis.navigator) {
  let pode = false
  try {
    pode = Boolean(nav?.canShare?.({ files: [new File([''], 'teste.png', { type: 'image/png' })] }))
  } catch { /* sem suporte */ }
  return modoDeSalvar({ userAgent: nav?.userAgent, maxTouchPoints: nav?.maxTouchPoints, podeCompartilharArquivos: pode })
}

// Chamar direto no toque, sem await antes: o Safari só compartilha dentro do gesto do usuário.
// Cancelar o compartilhamento não é erro; outra falha cai no download.
// Resolve 'compartilhado' | 'baixado' | 'cancelado'.
export function entregar(arquivos, modo, { nav = globalThis.navigator, baixar = baixarArquivos } = {}) {
  const baixarTudo = () => baixar(arquivos).then(() => 'baixado')
  if (modo !== 'compartilhar' || !nav?.canShare?.({ files: arquivos })) return baixarTudo()
  return nav.share({ files: arquivos }).then(() => 'compartilhado', (e) => {
    if (e?.name === 'AbortError') return 'cancelado'
    console.error(e)
    return baixarTudo()
  })
}
