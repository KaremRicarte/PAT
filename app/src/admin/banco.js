import { t } from '../textos.js'
import { el } from '../comum.js'
import { reduzirFoto, FOTO_MAX } from '../cliente/negocio.js'
import { listaRamos } from './ramo.js'
import { resumoDoBanco } from './bancoResumo.js'
import { listarBanco, listarArquivosDoBanco, enviarParaBanco, descreverBanco, urlDaFoto, removerDoBanco } from './dados.js'

const ehFoto = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)

export function areaBanco() {
  const ramo = el('select', { id: 'banco-ramo', 'aria-label': t('admin.ramo') },
    el('option', { value: '', texto: t('admin.ramo.escolha') }),
    listaRamos().map((r) => el('option', { value: r.id, texto: r.nome })))
  const entrada = el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true })
  const enviar = el('button', { type: 'button', texto: t('banco.enviar'), disabled: true })
  const msg = el('div', { class: 'aviso' })
  const resumo = el('p', { class: 'muted' })
  const grade = el('div', { class: 'grade-banco' })

  const erro = (texto) => msg.replaceChildren(el('p', { class: 'erro', role: 'alert', texto }))

  async function recarregar() {
    if (!ramo.value) { resumo.textContent = ''; grade.replaceChildren(); return }
    const lote = ramo.value
    let fotos, arquivos
    try { [fotos, arquivos] = await Promise.all([listarBanco(lote), listarArquivosDoBanco(lote)]) } catch { return erro(t('erro.geral')) }
    if (ramo.value !== lote) return
    const descritas = new Map(fotos.map((f) => [f.path, f]))
    const todas = [...new Set([...arquivos, ...descritas.keys()])]
    const { total, servem } = resumoDoBanco(fotos)
    resumo.textContent = t('banco.resumo', { total, servem })
    if (!todas.length) return grade.replaceChildren(el('p', { class: 'muted', texto: t('banco.vazio') }))
    const cartoes = todas.map((path) => cartao(path, descritas.get(path)))
    grade.replaceChildren(...cartoes.map((c) => c.no))
    for (const c of cartoes) { // URLs assinadas: nada de object URL para revogar
      const u = await urlDaFoto(c.path)
      if (ramo.value !== lote) return
      if (u) c.img.src = u
    }
  }

  function cartao(path, d) {
    const img = el('img', { alt: '', loading: 'lazy' })
    const remover = el('button', { type: 'button', class: 'secundario pequeno', texto: t('banco.remover') })
    remover.addEventListener('click', async () => {
      if (!confirm(t('banco.remover.confirma'))) return
      remover.disabled = true
      const r = await removerDoBanco(path)
      if (r.erro) { remover.disabled = false; return erro(r.erro) }
      msg.replaceChildren()
      await recarregar()
    })
    const selo = !d ? el('span', { class: 'selo neutro', texto: t('banco.sem') })
      : el('span', { class: d.serve ? 'selo bom' : 'selo ruim', texto: d.serve ? t('banco.serve') : t('banco.naoserve') })
    const no = el('div', { class: 'cartao-banco' }, img,
      el('p', { texto: d?.descricao ?? '' }), selo,
      d && !d.serve && d.motivo ? el('p', { class: 'muted', texto: d.motivo }) : null, remover)
    return { no, img, path }
  }

  async function subir(arquivos) {
    if (!ramo.value) return erro(t('banco.escolha'))
    const lote = ramo.value
    const candidatas = arquivos.filter(ehFoto)
    if (!candidatas.length) return
    enviar.disabled = true
    const paths = []
    let falhas = 0
    for (const [i, a] of candidatas.entries()) {
      msg.replaceChildren(el('p', { class: 'muted', role: 'status', texto: t('banco.enviando', { i: i + 1, n: candidatas.length }) }))
      try {
        const p = await enviarParaBanco(lote, await reduzirFoto(a, FOTO_MAX, 'image/jpeg'))
        if (p) paths.push(p); else falhas++
      } catch { falhas++ } // HEIC ou arquivo que o navegador não abre: pula
    }
    if (paths.length) {
      msg.replaceChildren(el('p', { class: 'muted', role: 'status', texto: t('banco.descrevendo') }))
      await descreverBanco(paths, lote)
    }
    enviar.disabled = !ramo.value
    if (falhas) erro(t('banco.falhas', { n: falhas })); else msg.replaceChildren()
    await recarregar()
  }

  ramo.addEventListener('change', () => { enviar.disabled = !ramo.value; msg.replaceChildren(); recarregar() })
  enviar.addEventListener('click', () => entrada.click())
  entrada.addEventListener('change', () => { const f = [...entrada.files]; entrada.value = ''; subir(f) })

  return el('section', { class: 'banco' },
    el('h2', { texto: t('banco.titulo') }),
    el('p', { class: 'muted', texto: t('banco.licenca') }),
    el('div', { class: 'banco-barra' }, ramo, enviar, entrada),
    msg, resumo, grade)
}
