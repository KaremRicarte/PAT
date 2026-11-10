// Tipos dos modelos de conteúdo. Sem dependências: usados pela função gerar-mes (Deno) e pelo app (Vite).

export type RamoId = string // de propósito: a lista válida é o registro (ramos/index.ts), não um tipo fechado
export type Estrategia = 'vender' | 'crescer' | 'credibilidade' | 'tempo'
export type Tom = 'proximo' | 'tecnico' | 'promo'
export type Pilar = 'demo' | 'aprox' | 'need'

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
