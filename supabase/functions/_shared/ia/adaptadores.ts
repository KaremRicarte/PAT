// Adaptadores de verdade da IA (Etapa 4A): Claude pelo SDK, Pexels, Pixabay, Storage e o registro de uso.
// Só Deno (usa `npm:`): o Vitest não importa este arquivo. As regras ficam nos módulos puros
// (escrever.ts, descrever.ts, imagens.ts, uso.ts); aqui só há rede e banco, e nada lança erro para quem chama.
import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { motivoDoErroHttp, type ChamarIA, type ConteudoIA, type Esforco, type RespostaIA } from './escrever.ts'
import { corpoFal, hostPermitido, lerRespostaFal } from './fal.ts'
import type { Externa } from './imagens.ts'
import type { RegistroUso } from './uso.ts'

export const MODELO = 'claude-opus-5-5'
// Tempo máximo de uma chamada: fila em segundo plano e trocas na hora ("Gerar outro", "Trocar imagem").
export const TEMPO_FILA_MS = 60_000
export const TEMPO_TROCA_MS = 30_000

type Bloco = Anthropic.Beta.Messages.BetaTextBlockParam | Anthropic.Beta.Messages.BetaImageBlockParam

const bloco = (c: ConteudoIA): Bloco => (c.tipo === 'texto'
  ? { type: 'text', text: c.texto }
  : { type: 'image', source: { type: 'url', url: c.url } })

// ChamarIA com o Claude Opus 5.5. Sem chave: sempre { ok:false, motivo:'erro' } (o app segue com os modelos).
// Sem novas tentativas escondidas no SDK (maxRetries: 0): cada chamada à API passa por comLimiteEUso,
// que conta e registra cada uma no limite do mês. Quem quiser tentar de novo chama outra vez.
// effort: 'low' nas chamadas com o cliente esperando; o `esforco` do pedido vence.
export function criarChamarIA(apiKey: string | undefined, opcoes: { timeoutMs: number, effort?: Esforco }): ChamarIA {
  if (!apiKey) return async () => ({ ok: false, motivo: 'erro' })
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: opcoes.timeoutMs })

  return async (pedido): Promise<RespostaIA> => {
    try {
      const resposta = await client.beta.messages.create({
        model: MODELO,
        max_tokens: pedido.maxTokens,
        // recusa do Opus 5.5: o servidor tenta de novo em outro modelo, dentro da mesma chamada
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: pedido.esforco ?? opcoes.effort ?? 'medium',
          format: { type: 'json_schema', schema: pedido.esquema as { [k: string]: unknown } },
        },
        system: pedido.sistema,
        messages: [{ role: 'user', content: pedido.conteudo.map(bloco) }],
      }, {
        // uma tentativa só; o signal garante o corte mesmo se o timeout do SDK não pegar
        timeout: opcoes.timeoutMs,
        maxRetries: 0,
        signal: AbortSignal.timeout(opcoes.timeoutMs),
      })

      const u = resposta.usage
      const tokensEntrada = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
      const tokensSaida = u.output_tokens ?? 0

      if (resposta.stop_reason === 'refusal') {
        console.error('IA: recusa', resposta.stop_details?.category ?? null)
        return { ok: false, motivo: 'recusa', tokensEntrada, tokensSaida }
      }
      if (resposta.stop_reason !== 'end_turn' && resposta.stop_reason !== 'stop_sequence') {
        // max_tokens e outros: resposta cortada, não dá para confiar no JSON
        console.error('IA: parou por', resposta.stop_reason)
        return { ok: false, motivo: 'erro', tokensEntrada, tokensSaida }
      }
      const texto = resposta.content.find((b) => b.type === 'text')
      if (!texto || texto.type !== 'text') return { ok: false, motivo: 'erro', tokensEntrada, tokensSaida }
      try {
        return { ok: true, dados: JSON.parse(texto.text), tokensEntrada, tokensSaida }
      } catch {
        console.error('IA: resposta não é JSON')
        return { ok: false, motivo: 'erro', tokensEntrada, tokensSaida }
      }
    } catch (e) {
      if (e instanceof Anthropic.APIUserAbortError || e instanceof Anthropic.APIConnectionTimeoutError) {
        return { ok: false, motivo: 'tempo' }
      }
      if (e instanceof Anthropic.APIError) {
        console.error('IA: erro da API', e.status, e.message)
        // 429, 529 e 5xx: passageiro ('ocupado'); a fila devolve o post para tentar depois
        return { ok: false, motivo: motivoDoErroHttp(e.status) }
      }
      console.error('IA: erro', e)
      return { ok: false, motivo: 'erro' }
    }
  }
}

// ---------- Storage ----------

// URL assinada (válida por alguns minutos) para a IA ver a foto. null se o arquivo não existe.
export async function urlAssinada(db: SupabaseClient, bucket: string, path: string, segundos = 300): Promise<string | null> {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, segundos)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

const TIPOS_DE_IMAGEM = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

// Copia uma foto do Pexels/Pixabay/fal.ai (só dos servidores permitidos, ver hostPermitido) para a pasta do cliente no bucket marcas e devolve o CAMINHO no Storage
// ({uid}/banco/{origem}-{id}.jpg) — nunca a URL externa, que não pode virar foto_path. null se não deu.
export async function copiarExterna(
  db: SupabaseClient, clienteId: string, origem: 'pexels' | 'pixabay' | 'gerada', externa: Pick<Externa, 'id' | 'url'>,
): Promise<string | null> {
  try {
    const url = new URL(externa.url)
    if (url.protocol !== 'https:' || !hostPermitido(url.hostname)) return null
    if (!/^[\w-]+$/.test(externa.id)) return null
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    const tipo = (r.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!r.ok || !TIPOS_DE_IMAGEM.includes(tipo)) return null
    const bytes = new Uint8Array(await r.arrayBuffer())
    if (!bytes.length || bytes.length > MAX_BYTES) return null
    const path = `${clienteId}/banco/${origem}-${externa.id}.jpg`
    const { error } = await db.storage.from('marcas').upload(path, bytes, { contentType: tipo, upsert: true })
    if (error) { console.error('copiarExterna: upload', path, error); return null }
    return path
  } catch (e) {
    console.error('copiarExterna', origem, externa.id, e)
    return null
  }
}

// Copia uma foto do banco próprio ({ramo}/{arquivo}) para a pasta do cliente ({uid}/banco/banco-{arquivo}).
export async function copiarDoBanco(db: SupabaseClient, clienteId: string, pathNoBanco: string): Promise<string | null> {
  try {
    const arquivo = pathNoBanco.split('/').pop() ?? ''
    if (!/^[\w.-]+$/.test(arquivo) || arquivo.startsWith('.')) return null
    const { data, error } = await db.storage.from('banco').download(pathNoBanco)
    if (error || !data) { console.error('copiarDoBanco: download', pathNoBanco, error); return null }
    const path = `${clienteId}/banco/banco-${arquivo}`
    const up = await db.storage.from('marcas').upload(path, data, { contentType: data.type || 'image/jpeg', upsert: true })
    if (up.error) { console.error('copiarDoBanco: upload', path, up.error); return null }
    return path
  } catch (e) {
    console.error('copiarDoBanco', pathNoBanco, e)
    return null
  }
}

// ---------- Uso (limite e custo) ----------

export const registrarUso = (db: SupabaseClient) => async (r: RegistroUso): Promise<void> => {
  const { error } = await db.from('uso_ia').insert({
    cliente_id: r.clienteId, tipo: r.tipo, tokens_entrada: r.tokensEntrada, tokens_saida: r.tokensSaida, custo_usd: r.custoUsd,
  })
  if (error) throw error
}

// Chamadas do cliente no mês do calendário (São Paulo). Lança erro se o banco falhar (comLimiteEUso então não chama a IA).
export const contarUsoNoMes = (db: SupabaseClient) => async (clienteId: string): Promise<number> => {
  const { data, error } = await db.rpc('uso_ia_no_mes', { p_cliente: clienteId })
  if (error) throw error
  return typeof data === 'number' ? data : Number(data ?? 0)
}

// ---------- Pexels e Pixabay ----------
// Devolvem candidatas com a URL de uma imagem de tamanho médio. Sem chave ou com erro: [] (a fonte fica de fora).

const POR_PAGINA = 15

export function criarBuscarPexels(apiKey: string | undefined, porPagina = POR_PAGINA): (tema: string) => Promise<Externa[]> {
  return async (tema) => {
    if (!apiKey || !tema.trim()) return []
    try {
      const u = new URL('https://api.pexels.com/v1/search')
      u.searchParams.set('query', tema.trim())
      u.searchParams.set('per_page', String(porPagina))
      u.searchParams.set('locale', 'pt-BR')
      const r = await fetch(u, { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(10_000) })
      if (!r.ok) { console.error('Pexels', r.status); return [] }
      const corpo = await r.json() as { photos?: { id: number, photographer?: string, alt?: string, src?: { large?: string } }[] }
      return (corpo.photos ?? []).filter((f) => f.src?.large).map((f) => ({
        id: String(f.id), url: f.src!.large!, autor: f.photographer ?? '',
        ...(f.alt ? { descricao: f.alt } : {}),
      }))
    } catch (e) {
      console.error('Pexels', e)
      return []
    }
  }
}

export function criarBuscarPixabay(apiKey: string | undefined, porPagina = POR_PAGINA): (tema: string) => Promise<Externa[]> {
  return async (tema) => {
    if (!apiKey || !tema.trim()) return []
    try {
      const u = new URL('https://pixabay.com/api/')
      u.searchParams.set('key', apiKey)
      u.searchParams.set('q', tema.trim().slice(0, 100))
      u.searchParams.set('image_type', 'photo')
      u.searchParams.set('lang', 'pt')
      u.searchParams.set('safesearch', 'true')
      u.searchParams.set('per_page', String(Math.max(3, porPagina)))
      const r = await fetch(u, { signal: AbortSignal.timeout(10_000) })
      if (!r.ok) { console.error('Pixabay', r.status); return [] }
      const corpo = await r.json() as { hits?: { id: number, user?: string, tags?: string, webformatURL?: string }[] }
      return (corpo.hits ?? []).filter((f) => f.webformatURL).map((f) => ({
        id: String(f.id), url: f.webformatURL!, autor: f.user ?? '',
        ...(f.tags ? { descricao: f.tags } : {}),
      }))
    } catch (e) {
      // a URL leva a chave: não registrar a URL
      console.error('Pixabay', e instanceof Error ? e.name : 'erro')
      return []
    }
  }
}

// ---------- fal.ai (imagem gerada) ----------
// Gera uma imagem com o FLUX schnell. Sem chave: null (nada é gerado). Nunca lança erro: a fila não captura,
// e uma exceção faria o post desistir. A chave nunca vai para o log.
export function criarGerarImagem(apiKey: string | undefined) {
  if (!apiKey) return null
  return async (prompt: string, formato: 'feed' | 'vertical', timeoutMs: number) => {
    try {
      const r = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoFal(prompt, formato)),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!r.ok) { console.error('fal.ai', r.status); return null }
      const g = lerRespostaFal(await r.json())
      return g ? { id: crypto.randomUUID(), ...g } : null
    } catch (e) {
      console.error('fal.ai', e instanceof Error ? e.name : 'erro')
      return null
    }
  }
}
