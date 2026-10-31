/**
 * Conversão entre o valor do `<select>`/`<input>` e o valor que vai para o
 * estado e para o servidor, na tela de análise de jogadores.
 *
 * Existe como módulo separado por causa do gênero: o código anterior usava
 * `Boolean(value)`, e `Boolean('false')` é `true` — escolher "Feminino" gravava
 * masculino. A conversão agora é explícita e testável.
 */

/**
 * Valor que o `<select>` deve exibir a partir do que veio do banco.
 *
 * `gender` no banco é booleano (true = masculino); o `<select>` usa as strings
 * 'true'/'false'.
 */
export function valorDoGenero(genre: boolean): 'true' | 'false' {
    return genre ? 'true' : 'false'
}

/**
 * Converte o `value` do controle no valor do estado.
 *
 * - `string`  → o próprio texto;
 * - `date`    → `''` (a data é montada à parte, a partir do campo formatado);
 * - `boolean` → comparação com `'true'`, **nunca** `Boolean(...)`;
 * - demais    → número (é o caso de `id_fide`, ratings, `id_division`).
 */
export function converterValor(tipo: string, valor: string): string | number | boolean {
    if (tipo === 'string') return valor
    if (tipo === 'date') return ''
    if (tipo === 'boolean') return valor === 'true'

    return Number(valor)
}
