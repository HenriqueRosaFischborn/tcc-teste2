/**
 * Validação do comprovante de pagamento, no servidor.
 *
 * O `<input accept>` do formulário só filtra o seletor de arquivos do navegador;
 * quem manda o POST escolhe o que enviar. Antes desta validação, qualquer
 * arquivo de até 20 MB (`bodySizeLimit` do `next.config.ts`) entrava no bucket.
 *
 * Módulo puro: sem banco, sem `'use server'`.
 */

/**
 * Vale qualquer imagem: o comprovante chega como print, foto da tela do banco
 * ou foto tirada do papel, e cada aparelho salva num formato diferente.
 */
const PREFIXO_TIPO_IMAGEM = 'image/'

/**
 * Usado quando o navegador não informa o MIME (acontece em alguns aparelhos).
 * São as extensões dos formatos de imagem mais comuns, inclusive os de celular.
 */
const EXTENSOES_PERMITIDAS = [
    '.jpg', '.jpeg', '.jpe', '.jfif',
    '.png', '.gif', '.webp', '.bmp',
    '.heic', '.heif', '.avif',
    '.tif', '.tiff'
]

/**
 * O mesmo teto que o projeto já tinha: `serverActions.bodySizeLimit` é `20mb`
 * no `next.config.ts`. Um arquivo acima disso nem chega à action.
 *
 * O limite é do tamanho do arquivo; o corpo da requisição ainda soma o custo do
 * multipart, então na prática o máximo aceito pela plataforma fica um pouco
 * abaixo — quem estourar recebe o erro do Next, não esta mensagem.
 */
export const TAMANHO_MAXIMO_COMPROVANTE = 20 * 1024 * 1024

export type ResultadoComprovante = { ok: true } | { ok: false, motivo: string }

function temExtensaoPermitida(nome: string) {
    const minusculo = nome.toLowerCase()

    return EXTENSOES_PERMITIDAS.some((extensao) => minusculo.endsWith(extensao))
}

/**
 * Confere formato e tamanho.
 *
 * O tipo é aceito quando o MIME começa com `image/` **ou** a extensão do
 * arquivo é uma das permitidas: alguns navegadores mandam `type` vazio para
 * fotos, e recusar por isso bloquearia inscrição legítima.
 */
export function validarComprovante(arquivo: { size: number, type: string, name: string }): ResultadoComprovante {
    if (arquivo.size > TAMANHO_MAXIMO_COMPROVANTE) {
        return {
            ok: false,
            motivo: `O comprovante tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB e o limite é 20 MB. Envie uma foto menor.`
        }
    }

    const tipoAceito = arquivo.type.toLowerCase().startsWith(PREFIXO_TIPO_IMAGEM)

    if (!tipoAceito && !temExtensaoPermitida(arquivo.name)) {
        return {
            ok: false,
            motivo: 'O comprovante precisa ser uma imagem (JPG, PNG ou outro formato de imagem).'
        }
    }

    return { ok: true }
}
