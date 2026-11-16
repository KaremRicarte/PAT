import { t } from '../../app/src/textos.js'

// Toda combinação de rede + tipo que a geração cria tem botão e dica de "Enviar".
const COMBINACOES = [['instagram', 'feed'], ['instagram', 'stories'], ['facebook', 'feed'], ['tiktok', 'video'], ['whatsapp', 'status'], ['whatsapp', 'lista']]
test.each(COMBINACOES)('Enviar: %s / %s tem botão e dica', (rede, tipo) => {
  expect(t(`post.enviar.${rede}.${tipo}`)).toMatch(/^Enviar para o .+ – .+$/)
  expect(t(`post.enviar.dica.${rede}.${tipo}`)).toMatch(/^Na lista que abrir/)
})
