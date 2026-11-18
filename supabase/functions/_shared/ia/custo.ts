// Custo estimado de uma chamada ao Claude Opus 5.5: US$ 4 por milhão de tokens de entrada, US$ 20 por milhão de saída.
export const custoUsd = (tokensEntrada: number, tokensSaida: number): number =>
  (tokensEntrada * 4 + tokensSaida * 20) / 1_000_000

// Custo estimado de uma imagem gerada pelo FLUX (fal.ai): US$ 0,003 por megapixel, arredondado para cima.
export const custoImagemGerada = (largura: number, altura: number): number =>
  Math.ceil(largura * altura / 1_000_000) * 0.003
