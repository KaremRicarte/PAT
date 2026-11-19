// Tipos dos modelos de conteúdo. Sem dependências: usados pela função gerar-mes (Deno) e pelo app (Vite).

export type RamoId = string // de propósito: a lista válida é o registro (ramos/index.ts), não um tipo fechado
export type Estrategia = 'vender' | 'crescer' | 'credibilidade' | 'tempo'
export type Tom = 'proximo' | 'tecnico' | 'promo'
export type Pilar = 'demo' | 'aprox' | 'need'
export type Rede = 'instagram' | 'facebook' | 'tiktok' | 'whatsapp'
// Dias de post do cliente (plano escolhido no painel do admin): todos os dias, segunda a sábado,
// dias úteis (segunda a sexta sem feriados nacionais) ou segunda a sexta (com feriados).
export type Frequencia = 'todos' | 'seg_sab' | 'uteis' | 'seg_sex'
export const FREQUENCIAS: readonly Frequencia[] = ['todos', 'seg_sab', 'uteis', 'seg_sex']
export const lerFrequencia = (v: unknown): Frequencia => ((FREQUENCIAS as readonly unknown[]).includes(v) ? v as Frequencia : 'seg_sex')
export const REDES: readonly Rede[] = ['instagram', 'facebook', 'tiktok', 'whatsapp']

// Um produto, serviço ou tema do ramo, com os textos de cada pilar.
export type Item = {
  k: string, nome: string, cat: string, art?: string, curto: string, titulo?: string,
  gancho: string, demo: string, beneficio: string, dor: string, dorG: string, dorT: string, sol: string,
}

// Post de aproximação (bastidores, dicas, equipe...). Em `t` e `f`, {prod} e {loja} são trocados.
export type Aprox = {
  tema: string, fmt: 'Stories' | 'Reels' | 'Carrossel' | 'Post', poll?: string[], t: string, f: [string, string][],
}

export type Ramo = {
  id: RamoId, nome: string, desc: string, assunto: string,
  itens: string, itensQ: string, itemOne: string, nomeQ: string, quem: string,
  lib: Item[], aprox: Aprox[], tags: string[], ptags: Record<Pilar, string>,
  convite: Record<Tom, string>, tons: [Tom, string, string][],
  titulo: (it: Item) => string,
  gen: (nome: string, curto: string) => Omit<Item, 'k' | 'nome' | 'cat' | 'curto'>,
  textOnly: boolean, noPromo: boolean, cores: { cor1: string, cor2: string },
}
