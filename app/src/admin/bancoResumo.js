// Resumo do banco de imagens: quantas fotos há e quantas servem para os posts.
export function resumoDoBanco(fotos) {
  const lista = fotos ?? []
  return { total: lista.length, servem: lista.filter((f) => f.serve === true).length }
}
