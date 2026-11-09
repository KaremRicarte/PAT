import { criarCliente, redefinirSenha } from '../../supabase/functions/admin-clientes/acoes.ts'

const valido = { nome: 'Ana', email: 'ana@x.com', telefone: '11987654321', idioma: 'pt' }

function falsos(sobrescrever = {}) {
  return {
    criarUsuario: vi.fn(async () => ({ id: 'u1' })),
    apagarUsuario: vi.fn(async () => {}),
    inserirCliente: vi.fn(async () => ({})),
    trocarSenha: vi.fn(async () => ({})),
    marcarProvisoria: vi.fn(async () => ({})),
    senha: vi.fn(() => 'Senha12345'),
    ...Object.fromEntries(Object.entries(sobrescrever).map(([k, f]) => [k, vi.fn(f as any)])),
  }
}

test('dados inválidos → 400 sem criar usuário', async () => {
  const deps = falsos()
  expect(await criarCliente(deps, { ...valido, email: 'x' })).toEqual({ status: 400, corpo: { erro: 'E-mail inválido.' } })
  expect(deps.criarUsuario).not.toHaveBeenCalled()
})
test('e-mail repetido → 409 sem inserir', async () => {
  const deps = falsos({ criarUsuario: async () => ({ erro: 'email_existe' }) })
  expect(await criarCliente(deps, valido)).toEqual({ status: 409, corpo: { erro: 'Já existe um cliente com este e-mail.' } })
  expect(deps.inserirCliente).not.toHaveBeenCalled()
})
test('falha no insert apaga o usuário criado', async () => {
  const deps = falsos({ inserirCliente: async () => ({ erro: 'x' }) })
  expect((await criarCliente(deps, valido)).status).toBe(500)
  expect(deps.apagarUsuario).toHaveBeenCalledWith('u1')
})
test('insert com e-mail repetido → 409 e apaga o usuário', async () => {
  const deps = falsos({ inserirCliente: async () => ({ erro: 'email_existe' }) })
  expect((await criarCliente(deps, valido)).status).toBe(409)
  expect(deps.apagarUsuario).toHaveBeenCalledWith('u1')
})
test('sucesso devolve id e senha e grava a linha normalizada', async () => {
  const deps = falsos()
  expect(await criarCliente(deps, valido)).toEqual({ status: 201, corpo: { id: 'u1', senhaProvisoria: 'Senha12345' } })
  expect(deps.criarUsuario).toHaveBeenCalledWith('ana@x.com', 'Senha12345')
  expect(deps.inserirCliente).toHaveBeenCalledWith({
    id: 'u1', nome: 'Ana', email: 'ana@x.com', telefone: '5511987654321', idioma: 'pt', senha_provisoria: true,
  })
})
test('redefinir marca a senha como provisória', async () => {
  const deps = falsos()
  expect(await redefinirSenha(deps, 'u1')).toEqual({ status: 200, corpo: { senhaProvisoria: 'Senha12345' } })
  expect(deps.trocarSenha).toHaveBeenCalledWith('u1', 'Senha12345')
  expect(deps.marcarProvisoria).toHaveBeenCalledWith('u1')
})
test('redefinir sem id → 400', async () => {
  expect((await redefinirSenha(falsos(), '')).status).toBe(400)
})
test('redefinir com falha ao trocar → 500 sem marcar', async () => {
  const deps = falsos({ trocarSenha: async () => ({ erro: 'x' }) })
  expect((await redefinirSenha(deps, 'u1')).status).toBe(500)
  expect(deps.marcarProvisoria).not.toHaveBeenCalled()
})
test('redefinir id que não é cliente → 404 sem marcar', async () => {
  const deps = falsos({ trocarSenha: async () => ({ erro: 'nao_encontrado' }) })
  expect(await redefinirSenha(deps, 'u9')).toEqual({ status: 404, corpo: { erro: 'Cliente não encontrado.' } })
  expect(deps.marcarProvisoria).not.toHaveBeenCalled()
})
