// Caixinha "Ocultar preço" do item: o preço fica salvo, mas para os posts o item vale como item sem preço
// (sem selo na arte e sem parágrafo de preço na legenda). A data da promoção continua: o post da data sai sem valor.
// Aplicado na lista de produtos que as funções que geram posts leem (gerar-mes, refazer-posts, trocar-estrategia,
// trocar-post), para nenhuma regra de geração precisar saber da caixinha.
export function precosVisiveis<T extends { preco: number | null, preco_promo: number | null, ocultar_preco?: boolean | null }>(produtos: T[]): T[] {
  return produtos.map((p) => (p.ocultar_preco ? { ...p, preco: null, preco_promo: null } : p))
}
