import { formatCurrency } from "../../utils/currency";

interface ProductPriceProps {
  price: string;
  discountPrice?: string | null;
  currentPrice?: string;
  large?: boolean;
}

export function ProductPrice({
  price,
  discountPrice,
  currentPrice,
  large = false,
}: ProductPriceProps) {
  const finalPrice = currentPrice || discountPrice || price;
  const hasDiscount =
    Boolean(discountPrice) && Number(discountPrice) < Number(price);

  return (
    <div>
      {hasDiscount && (
        <p className="text-sm text-agro-muted">
          <span className="sr-only">Precio anterior </span>
          <s>{formatCurrency(price)}</s>
        </p>
      )}

      <p
        className={
          large
            ? "break-words text-3xl font-bold tabular-nums text-agro-forest"
            : "break-words text-xl font-bold tabular-nums text-agro-forest"
        }
      >
        {hasDiscount && <span className="sr-only">Precio actual </span>}
        {formatCurrency(finalPrice)}
      </p>
    </div>
  );
}
