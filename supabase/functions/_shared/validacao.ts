export type NovoCliente = { nome: string, email: string, telefone: string, idioma: 'pt' | 'es' }
export type Validacao = { ok: true, dados: NovoCliente } | { ok: false, erro: string }

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function validarNovoCliente(entrada: unknown): Validacao {
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>

  const nome = texto(e.nome)
  if (nome.length < 2) return { ok: false, erro: 'Informe o nome.' }

  const email = texto(e.email).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: 'E-mail inválido.' }

  const idioma = e.idioma
  if (idioma !== 'pt' && idioma !== 'es') return { ok: false, erro: 'Idioma deve ser pt ou es.' }

  let telefone = texto(e.telefone).replace(/\D/g, '')
  if (telefone.length === 10 || telefone.length === 11) {
    if (idioma === 'es') return { ok: false, erro: 'Inclua o código do país no telefone.' }
    telefone = '55' + telefone
  }
  if (telefone.length < 12 || telefone.length > 15) {
    return { ok: false, erro: 'Telefone inválido. Use DDD e número.' }
  }

  return { ok: true, dados: { nome, email, telefone, idioma } }
}
