// Substituto do pacote `server-only` para os testes.
//
// O pacote original lança erro quando não é resolvido sob a condição
// `react-server`, que é justamente o ambiente do app. Nos testes (Node puro)
// ele precisa ser neutro, senão importar `@/lib/auth-guard` explodiria.
export {}
