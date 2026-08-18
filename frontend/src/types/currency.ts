export function formatCurrency(
  value: string | number | null | undefined
): string {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(numericValue);
}