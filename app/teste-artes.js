// Script da página temporária teste-artes.html (fora do build). Apagar no fim da Task 6.
import { LOOKS } from '/src/artes/looks.js'
import { desenharArte } from '/src/artes/desenho.js'
import { esperarFontes } from '/src/artes/imagens.js'
import { assinaturaDaArte } from '/src/artes/texto.js'

const CORES = {
  varejo: { cor1: '#F2A21B', cor2: '#151925' },
  elegante: { cor1: '#B76E79', cor2: '#F6EFEA' },
  sereno: { cor1: '#2D6A4F', cor2: '#F3EBDD' },
  sobrio: { cor1: '#1D4E89', cor2: '#FFFFFF' },
}
const CURTO = {
  rotulo: 'LOJA DO TESTE', titulo: 'Furadeira de impacto com 20% off',
  gancho: 'Obra parada por falta de ferramenta?', meio: 'Potência de sobra para concreto e madeira.',
  convite: 'Chame no WhatsApp e garanta a sua.',
}
const LONGO = {
  rotulo: 'FERRAGENS E MATERIAIS DE CONSTRUÇÃO SÃO JOÃO DA BOA VISTA',
  titulo: 'Furadeira de impacto profissional com 20% de desconto só nesta semana para clientes da loja',
  gancho: 'Você já perdeu um dia inteiro de obra porque a ferramenta não deu conta do concreto? A gente sabe como isso atrasa tudo, encarece o serviço e ainda deixa o cliente insatisfeito no fim do mês.',
  meio: 'A furadeira de impacto profissional tem motor de 850 W, mandril de 13 mm e duas velocidades, então você fura concreto, madeira e metal sem trocar de máquina e sem esquentar o motor no meio do trabalho.',
  convite: 'Chame a gente no WhatsApp agora mesmo, reserve a sua e retire na loja ainda hoje com o desconto da semana garantido.',
}
const FORMAS = [
  { nome: 'Feed', W: 1080, H: 1350, paginas: 1 },
  { nome: 'Carrossel', W: 1080, H: 1350, paginas: 5 },
  { nome: 'Stories', W: 1080, H: 1920, paginas: 1 },
  { nome: 'Capa do vídeo', W: 720, H: 1280, paginas: 1, capaDeVideo: true },
]
let foto = null, logo = null

async function lerImagem(input) {
  const arq = input.files[0]
  if (!arq) return null
  try { return await createImageBitmap(arq) } catch { return null }
}

async function desenharTudo() {
  const saida = document.getElementById('saida')
  saida.replaceChildren()
  const textos = document.getElementById('longo').checked ? LONGO : CURTO
  const comFoto = document.getElementById('semFoto').checked ? null : foto
  for (const [estilo, look] of Object.entries(LOOKS)) {
    await esperarFontes(look)
    const h2 = document.createElement('h2')
    h2.textContent = estilo
    saida.append(h2)
    for (const forma of FORMAS) {
      const linha = document.createElement('div')
      linha.className = 'linha'
      for (let pagina = 1; pagina <= forma.paginas; pagina++) {
        const c = document.createElement('canvas')
        c.width = forma.W
        c.height = forma.H
        const pecas = { ...textos, assinatura: assinaturaDaArte({ texto: 'lojadoteste', logo: true }, Boolean(logo), 'Loja do Teste') }
        desenharArte(c.getContext('2d'), {
          pecas, look, cores: CORES[estilo], foto: comFoto, logo,
          W: forma.W, H: forma.H, pagina, paginas: forma.paginas, capaDeVideo: forma.capaDeVideo,
        })
        const fig = document.createElement('figure')
        const leg = document.createElement('figcaption')
        leg.textContent = forma.paginas > 1 ? `${forma.nome} ${pagina}/5` : forma.nome
        fig.append(c, leg)
        linha.append(fig)
      }
      saida.append(linha)
    }
  }
}

document.getElementById('foto').onchange = async (e) => { foto = await lerImagem(e.target); desenharTudo() }
document.getElementById('logo').onchange = async (e) => { logo = await lerImagem(e.target); desenharTudo() }
document.getElementById('longo').onchange = desenharTudo
document.getElementById('semFoto').onchange = desenharTudo
desenharTudo()
