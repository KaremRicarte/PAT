// Senha provisória: 10 caracteres, sem os ambíguos 0 O o 1 l I.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
const LIMITE = 256 - (256 % ALFABETO.length) // descarta bytes que dariam viés

const padrao = (n: number) => crypto.getRandomValues(new Uint8Array(n))

export function gerarSenha(aleatorio: (n: number) => Uint8Array = padrao): string {
  let senha = ''
  while (senha.length < 10) {
    for (const b of aleatorio(16)) {
      if (b < LIMITE && senha.length < 10) senha += ALFABETO[b % ALFABETO.length]
    }
  }
  return senha
}
