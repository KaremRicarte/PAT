// "Cutucada" na fila da IA: depois de gravar posts de modelo (gerar-mes, refazer-posts, trocar-estrategia), chama
// melhorar-posts para começar logo, sem esperar o próximo minuto do pg_cron. Só Deno.
// Nunca atrasa nem derruba a resposta do cliente: não é esperada, e qualquer erro só vai para o log
// (o pg_cron pega os posts no minuto seguinte de qualquer jeito).

declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined

export function cutucarMelhorarPosts(urlProjeto: string): void {
  const segredo = Deno.env.get('MELHORAR_POSTS_SECRET')
  if (!segredo) return
  try {
    const pedido = fetch(`${urlProjeto}/functions/v1/melhorar-posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-melhorar-secret': segredo },
      body: '{}',
      // melhorar-posts responde na hora (trabalha em segundo plano); isto só protege contra rede travada
      signal: AbortSignal.timeout(10_000),
    })
      .then((r) => r.body?.cancel())
      .catch((e) => console.error('cutucar melhorar-posts', e instanceof Error ? e.name : e))
    // mantém a função viva até o pedido sair, mesmo depois de responder ao cliente
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(pedido)
  } catch (e) {
    console.error('cutucar melhorar-posts', e)
  }
}
