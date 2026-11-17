// Custo estimado de uma chamada ao Claude Opus 5.5: US$ 4 por milhão de tokens de entrada, US$ 20 por milhão de saída.
export const custoUsd = (tokensEntrada: number, tokensSaida: number): number =>
  (tokensEntrada * 4 + tokensSaida * 20) / 1_000_000
