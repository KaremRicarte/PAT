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

  // pt: 10–11 dígitos = número brasileiro sem DDI → acrescenta 55.
  // es: o DDI é obrigatório; 10 dígitos é número sem DDI. Com DDI vale de 11 a 15
  // (Chile, Peru, Uruguai e outros têm 11 dígitos já com o código do país).
  let telefone = texto(e.telefone).replace(/\D/g, '')
  if (idioma === 'pt' && (telefone.length === 10 || telefone.length === 11)) telefone = '55' + telefone
  if (idioma === 'es' && telefone.length === 10) {
    return { ok: false, erro: 'Inclua o código do país no telefone.' }
  }
  const minimo = idioma === 'pt' ? 12 : 11
  if (telefone.length < minimo || telefone.length > 15) {
    return { ok: false, erro: 'Telefone inválido. Use DDD e número.' }
  }

  return { ok: true, dados: { nome, email, telefone, idioma } }
}
