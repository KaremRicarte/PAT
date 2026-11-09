// Regras da função admin-clientes, sem nenhuma API do Deno (o Vitest importa este arquivo).
import { validarNovoCliente } from '../_shared/validacao.ts'

type Erro = { erro?: string }
export type Deps = {
  criarUsuario(email: string, senha: string): Promise<{ id: string } | { erro: 'email_existe' | string }>
  apagarUsuario(id: string): Promise<unknown>
  inserirCliente(linha: Record<string, unknown>): Promise<Erro>
  trocarSenha(id: string, senha: string): Promise<Erro>
  marcarProvisoria(id: string): Promise<Erro>
  senha(): string
}
export type Resposta = { status: number, corpo: Record<string, unknown> }

const EMAIL_REPETIDO: Resposta = { status: 409, corpo: { erro: 'Já existe um cliente com este e-mail.' } }

export async function criarCliente(deps: Deps, entrada: unknown): Promise<Resposta> {
  const v = validarNovoCliente(entrada)
  if (!v.ok) return { status: 400, corpo: { erro: v.erro } }

  const senha = deps.senha()
  const usuario = await deps.criarUsuario(v.dados.email, senha)
  if ('erro' in usuario) {
    if (usuario.erro === 'email_existe') return EMAIL_REPETIDO
    return { status: 500, corpo: { erro: 'Não foi possível criar o cliente.' } }
  }

  const ins = await deps.inserirCliente({ id: usuario.id, ...v.dados, senha_provisoria: true })
  if (ins.erro) {
    await deps.apagarUsuario(usuario.id) // não deixa usuário órfão no Auth
    if (ins.erro === 'email_existe') return EMAIL_REPETIDO
    return { status: 500, corpo: { erro: 'Não foi possível criar o cliente.' } }
  }

  return { status: 201, corpo: { id: usuario.id, senhaProvisoria: senha } }
}

export async function redefinirSenha(deps: Deps, id: unknown): Promise<Resposta> {
  if (typeof id !== 'string' || !id) return { status: 400, corpo: { erro: 'Cliente inválido.' } }

  const senha = deps.senha()
  const troca = await deps.trocarSenha(id, senha)
  if (troca.erro === 'nao_encontrado') return { status: 404, corpo: { erro: 'Cliente não encontrado.' } }
  if (troca.erro) return { status: 500, corpo: { erro: 'Não foi possível redefinir a senha.' } }

  const marca = await deps.marcarProvisoria(id)
  if (marca.erro) return { status: 500, corpo: { erro: 'Não foi possível redefinir a senha.' } }

  return { status: 200, corpo: { senhaProvisoria: senha } }
}
