// Detecção do aparelho, usada ao salvar arquivos e nos lembretes.

// iPhone/iPad (iOS). O iPad no modo computador se apresenta como Mac: a diferença é a tela de toque.
export function ehIphone(userAgent = '', maxTouchPoints = 0) {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}
