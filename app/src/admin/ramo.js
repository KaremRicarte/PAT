// Ramos para o painel: a lista vem do registro, então um ramo novo aparece aqui sozinho.
import { RAMOS, ramoValido, listaRamos } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'

export { listaRamos }

export function nomeDoRamo(id) {
  return ramoValido(id) ? RAMOS[id].nome : '—'
}
