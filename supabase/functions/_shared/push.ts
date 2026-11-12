// Envio de uma notificação push (Web Push com VAPID). Só roda no Deno (as funções lembrete e lembrete-teste).
import webpush from 'npm:web-push@3.6.7'

export type Inscricao = { id: string, cliente_id: string, endpoint: string, p256dh: string, auth: string }
export type PayloadPush = { titulo: string, corpo: string, url: string }
export type ResultadoPush = 'ok' | 'expirada' | 'erro'

// Configura as chaves VAPID só no primeiro envio: sem os segredos, o resto da função (ex.: o 401) continua respondendo.
let configurado = false
function configurar() {
  if (configurado) return
  webpush.setVapidDetails(
    `mailto:${Deno.env.get('VAPID_CONTATO')}`,
    Deno.env.get('VAPID_PUBLICA')!,
    Deno.env.get('VAPID_PRIVADA')!,
  )
  configurado = true
}

export async function enviarPush(inscricao: Inscricao, payload: PayloadPush): Promise<ResultadoPush> {
  try {
    configurar()
    await webpush.sendNotification(
      { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
      JSON.stringify(payload),
    )
    return 'ok'
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    // 404/410: o navegador cancelou a inscrição; ela pode ser apagada.
    if (status === 404 || status === 410) return 'expirada'
    console.error('push falhou', status ?? e)
    return 'erro'
  }
}

// Envia para várias inscrições e devolve a contagem e os ids das expiradas (para apagar).
export async function enviarParaTodas(
  envios: { inscricao: Inscricao, payload: PayloadPush }[],
): Promise<{ enviados: number, erros: number, expiradas: string[] }> {
  const resultados = await Promise.all(envios.map(({ inscricao, payload }) => enviarPush(inscricao, payload)))
  const expiradas = envios.filter((_, i) => resultados[i] === 'expirada').map(({ inscricao }) => inscricao.id)
  return {
    enviados: resultados.filter((r) => r === 'ok').length,
    erros: resultados.filter((r) => r === 'erro').length,
    expiradas,
  }
}
