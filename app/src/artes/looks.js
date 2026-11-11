// Estilo da arte de cada ramo (tabela LOOKS do v1, bancada/index.html).
// fd = fonte do título, fb = fonte do texto, dw = peso do título, hs = escala do título,
// center = texto centralizado, box = título com tarja colorida.
export const LOOKS = Object.freeze({
  varejo: Object.freeze({ fd: '"Bricolage Grotesque","Segoe UI",sans-serif', fb: '"Nunito Sans","Segoe UI",sans-serif', dw: 800, hs: 1, box: true }),
  elegante: Object.freeze({ fd: '"Cormorant Garamond",Georgia,serif', fb: '"Montserrat","Segoe UI",sans-serif', dw: 600, hs: 1.15, center: true }),
  sereno: Object.freeze({ fd: '"Fraunces",Georgia,serif', fb: '"DM Sans","Segoe UI",sans-serif', dw: 500, hs: 1.02 }),
  sobrio: Object.freeze({ fd: '"Playfair Display",Georgia,serif', fb: '"Source Sans 3","Segoe UI",sans-serif', dw: 700, hs: 1 }),
})

const ESTILO_DO_RAMO = { beleza: 'elegante', psicologia: 'sereno', advocacia: 'sobrio' }

// Nome do estilo do ramo (os ramos sem estilo próprio usam o varejo).
export function estiloDoRamo(ramoId) {
  return ESTILO_DO_RAMO[ramoId] ?? 'varejo'
}

export function lookDoRamo(ramoId) {
  return LOOKS[estiloDoRamo(ramoId)]
}

// Fontes que precisam estar carregadas antes de desenhar com o estilo.
export function fontesDoLook(look) {
  return [`${look.dw} 40px ${look.fd}`, `800 40px ${look.fb}`, `700 40px ${look.fb}`]
}
