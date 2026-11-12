import { mensagemDoErroDeVideo } from '../../app/src/cliente/enviarVideo.js'

test('mensagemDoErroDeVideo: sem suporte fala em editar; os outros usam video.erro.*', () => {
  expect(mensagemDoErroDeVideo('sem-suporte')).toBe('Seu celular não consegue editar vídeos aqui. Use o roteiro e edite no app da rede social.')
  expect(mensagemDoErroDeVideo('longo')).toBe('Escolha um vídeo de até 60 segundos.')
  expect(mensagemDoErroDeVideo('invalido')).toBe('Não consegui abrir este vídeo. Tente outro.')
  expect(mensagemDoErroDeVideo('interrompido')).toBe('Mantenha a tela aberta enquanto o vídeo é montado.')
  for (const c of ['sem-permissao', 'falhou']) expect(mensagemDoErroDeVideo(c)).toMatch(/\S/)
})

test('mensagemDoErroDeVideo: código desconhecido vira "falhou"', () => {
  expect(mensagemDoErroDeVideo('outra-coisa')).toBe('Não consegui montar o vídeo. Tente de novo.')
})
