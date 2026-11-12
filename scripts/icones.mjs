// Gera os ícones do app instalável (manifest e tela de início do iPhone) a partir do pat-icon.png:
// o logo centralizado num quadrado preto, com margem de 12% de cada lado.
// Uso: node scripts/icones.mjs
import sharp from 'sharp'
import { resolve } from 'node:path'

const pasta = resolve(import.meta.dirname, '../app/public/img')
const origem = resolve(pasta, 'pat-icon.png')
const FUNDO = '#000000'
const MARGEM = 0.12

for (const tamanho of [192, 512]) {
  const lado = Math.round(tamanho * (1 - 2 * MARGEM))
  const logo = await sharp(origem).resize(lado, lado, { fit: 'contain', background: FUNDO }).toBuffer()
  await sharp({ create: { width: tamanho, height: tamanho, channels: 3, background: FUNDO } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(resolve(pasta, `icone-${tamanho}.png`))
  console.log(`icone-${tamanho}.png`)
}
