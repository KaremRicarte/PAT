// Regras da função descrever-fotos, sem nenhuma API do Deno (o Vitest importa este arquivo).
// A IA descreve cada foto nova uma vez e diz se ela serve para post (spec §3.1, §3.6, §7 itens 10-11).
// Cliente: só as fotos da pasta dele no bucket marcas. Admin: fotos do banco de imagens (bucket banco), pasta do ramo.
import type { Resposta } from '../admin-clientes/acoes.ts'
import type { ChamarIA } from '../_shared/ia/escrever.ts'
import { descreverFoto } from '../_shared/ia/descrever.ts'
import { comLimiteEUso, type RegistroUso } from '../_shared/ia/uso.ts'
import { RAMOS, ramoValido } from '../_shared/modelos/ramos/index.ts'

export const MAX_FOTOS = 30
// fotos descritas ao mesmo tempo (30 em fila passariam do tempo da função)
const EM_PARALELO = 3

export type LinhaFotoIA = {
  path: string, cliente_id: string | null, origem: 'cliente' | 'banco', ramo: string | null,
  descricao: string, serve: boolean, motivo: string | null,
}
export type FotoDescrita = { path: string, serve: boolean, motivo: string | null }

export type DepsDescrever = {
  // quem chamou, do token validado pelo Auth (admin = app_metadata.role)
  quem: { id: string, admin: boolean },
  cliente: () => Promise<{ id: string, situacao: string, senha_provisoria: boolean, ramo: string | null } | null>,
  // dos paths pedidos, os que já estão em fotos_ia
  jaDescritas: (paths: string[]) => Promise<string[]>,
  // URL assinada por alguns minutos; null se o arquivo não existe
  urlAssinada: (bucket: 'marcas' | 'banco', path: string) => Promise<string | null>,
  // null = sem ANTHROPIC_API_KEY
  chamar: ChamarIA | null,
  contarNoMes: (clienteId: string) => Promise<number>,
  registrarUso: (r: RegistroUso) => Promise<void>,
  gravarFoto: (linha: LinhaFotoIA) => Promise<void>,
}

const r = (status: number, erro: string): Resposta => ({ status, corpo: { erro } })
const NADA: Resposta = { status: 200, corpo: { descritas: 0, fotos: [] } }

const caminhoSeguro = (p: string) => !p.split('/').some((s) => s === '..' || s === '.' || s === '')

function lerPaths(entrada: Record<string, unknown>): string[] | null {
  const { paths } = entrada
  if (!Array.isArray(paths) || !paths.length || paths.length > MAX_FOTOS) return null
  if (!paths.every((p) => typeof p === 'string' && p.trim())) return null
  return [...new Set(paths as string[])]
}

export async function descreverFotos(entrada: unknown, deps: DepsDescrever): Promise<Resposta> {
  const corpo = entrada && typeof entrada === 'object' ? entrada as Record<string, unknown> : {}
  const pedidos = lerPaths(corpo)
  if (!pedidos) return r(400, `Envie de 1 a ${MAX_FOTOS} fotos.`)

  let alvo: { bucket: 'marcas' | 'banco', pasta: string, clienteId: string | null, origem: 'cliente' | 'banco', ramo: string | null, contexto: string }
  if (deps.quem.admin) {
    if (!ramoValido(corpo.ramo)) return r(400, 'Escolha o ramo.')
    const ramo = corpo.ramo
    alvo = { bucket: 'banco', pasta: `${ramo}/`, clienteId: null, origem: 'banco', ramo,
      contexto: `Banco de imagens do ramo ${RAMOS[ramo].nome}: foto para posts de vários negócios do ramo.` }
  } else {
    const cliente = await deps.cliente()
    if (!cliente || cliente.situacao !== 'ativo' || cliente.senha_provisoria) return r(403, 'Seu acesso não permite enviar fotos.')
    const ramo = ramoValido(cliente.ramo) ? cliente.ramo : null
    alvo = { bucket: 'marcas', pasta: `${deps.quem.id}/`, clienteId: deps.quem.id, origem: 'cliente', ramo,
      contexto: ramo ? `Foto enviada por um negócio do ramo ${RAMOS[ramo].nome}.` : 'Foto enviada por um negócio.' }
  }

  // só a pasta de quem chamou; o resto é ignorado (e se não sobrar nada, é recusa).
  // {uid}/banco/ guarda cópias do Pexels/Pixabay/banco próprio: não são fotos "do cliente" (spec §3.7).
  const permitidos = pedidos.filter((p) => p.startsWith(alvo.pasta) && caminhoSeguro(p)
    && !(alvo.origem === 'cliente' && p.startsWith(`${alvo.pasta}banco/`)))
  if (!permitidos.length) return r(403, 'Estas fotos não são suas.')

  if (!deps.chamar) return NADA
  const ja = new Set(await deps.jaDescritas(permitidos))
  const novos = permitidos.filter((p) => !ja.has(p))
  if (!novos.length) return NADA

  const comUso = comLimiteEUso(deps.chamar, {
    clienteId: alvo.clienteId, tipo: 'foto', registrar: deps.registrarUso, contarNoMes: deps.contarNoMes,
  })
  let bateuLimite = false
  const chamar: ChamarIA = async (pedido) => {
    const resposta = await comUso(pedido)
    if (!resposta.ok && resposta.motivo === 'limite') bateuLimite = true
    return resposta
  }

  const resultado: (FotoDescrita | null)[] = novos.map(() => null)
  let proximo = 0
  const trabalhar = async () => {
    while (!bateuLimite && proximo < novos.length) {
      const i = proximo++
      const path = novos[i]
      try {
        const url = await deps.urlAssinada(alvo.bucket, path)
        if (!url) continue
        const d = await descreverFoto(chamar, { url, contexto: alvo.contexto })
        // falhou (ou limite): não grava; a foto é descrita numa próxima vez
        if (!d) continue
        await deps.gravarFoto({ path, cliente_id: alvo.clienteId, origem: alvo.origem, ramo: alvo.ramo,
          descricao: d.descricao, serve: d.serve, motivo: d.motivo })
        resultado[i] = { path, serve: d.serve, motivo: d.motivo }
      } catch (e) {
        // uma foto com problema não derruba as outras
        console.error('descrever-fotos: falhou numa foto', path, e)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(EM_PARALELO, novos.length) }, trabalhar))

  const fotos = resultado.filter((f): f is FotoDescrita => f !== null)
  return { status: 200, corpo: { descritas: fotos.length, fotos } }
}
