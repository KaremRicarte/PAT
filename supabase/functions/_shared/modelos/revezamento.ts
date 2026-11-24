// Revezamento das fotos de um item entre os posts e os meses. Arquivo sem dependências: o app (situacao.js) e o
// servidor (_shared/ia/imagens.ts) importam daqui.
// Posição da foto da vez numa lista de `n` fotos: a ordem do post somada a 31 por mês, como se a ordem continuasse de
// um mês para o outro. 31 é primo e maior que 12 (o máximo de fotos por item), então o salto entre meses nunca é
// múltiplo de n e as fotos sempre mudam de um mês para o outro. Sem data válida: só a ordem. Sem fotos: -1.
// Usada aqui e em situacao.js (app), para o app e o servidor mostrarem a mesma foto.
export function indiceDoRevezamento(ordem: number | null | undefined, data: string | null | undefined, n: number): number {
  if (n <= 0) return -1
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(data ?? '')
  const mes = m ? Number(m[1]) * 12 + Number(m[2]) - 1 : 0
  return ((ordem ?? 0) + mes * 31) % n
}
