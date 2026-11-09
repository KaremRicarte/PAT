// O papel vem de app_metadata, que só a chave secreta grava.
export const ehAdmin = (sessao) => sessao?.user?.app_metadata?.role === 'admin'
