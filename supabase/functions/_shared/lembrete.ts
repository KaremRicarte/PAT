// Regras dos lembretes das 8h e das 20h, sem nenhuma API do Deno (o Vitest importa este arquivo).

export type Turno = 'manha' | 'noite'
export type LinhaLembrete = {
  cliente_id: string, situacao: string, rede: string, estado: string, postado_em: string | null,
}
export type Aviso = { total: number, redes: string[] }

const ORDEM_REDES = ['instagram', 'facebook', 'tiktok', 'whatsapp']
const NOME_REDE: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', whatsapp: 'Status do WhatsApp',
}

export function turnoValido(turno: unknown): turno is Turno {
  return turno === 'manha' || turno === 'noite'
}

// Quem recebe o lembrete de hoje: clientes ativos, sem contar os posts reprovados;
// à noite, só os posts que ainda não foram marcados como postados.
export function quemAvisar(turno: Turno, linhas: LinhaLembrete[]): Map<string, Aviso> {
  const avisos = new Map<string, Aviso>()
  for (const l of linhas) {
    if (l.situacao !== 'ativo' || l.estado === 'reprovado') continue
    if (turno === 'noite' && l.postado_em) continue
    const aviso = avisos.get(l.cliente_id) ?? { total: 0, redes: [] }
    aviso.total += 1
    if (!aviso.redes.includes(l.rede)) aviso.redes.push(l.rede)
    avisos.set(l.cliente_id, aviso)
  }
  for (const aviso of avisos.values()) {
    aviso.redes.sort((a, b) => ORDEM_REDES.indexOf(a) - ORDEM_REDES.indexOf(b))
  }
  return avisos
}

// "a", "a e b", "a, b e c"
function juntar(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

export function textoDoLembrete(turno: Turno, { total, redes }: Aviso): { titulo: 'PAT', corpo: string } {
  const posts = `${total} ${total === 1 ? 'post' : 'posts'}`
  const corpo = turno === 'manha'
    ? `Bom dia! Hoje você tem ${posts}: ${juntar(redes.map((r) => NOME_REDE[r] ?? r))} 📲`
    : `Ainda falta postar ${posts} de hoje. Leva 1 minutinho 😉`
  return { titulo: 'PAT', corpo }
}
