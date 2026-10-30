const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export const formatCurrency = (value: number) => currencyFormatter.format(value)

/** Enter nos campos de texto apenas confirma o preenchimento (sai do campo), sem enviar o formulário. */
export function handleEnterBlur(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') {
    event.preventDefault()
    event.currentTarget.blur()
  }
}
