interface ProductPriceProps {
  price: string;
  discountPrice?: string | null;
  currentPrice?: string;
  large?: boolean;
}

function formatPrice(value: string) {
  const number = Number(value);

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(number);
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
        <p className="text-sm text-gray-400 line-through">
          {formatPrice(price)}
        </p>
      )}

      <p
        className={
          large
            ? "text-3xl font-bold text-green-700"
            : "text-xl font-bold text-green-700"
        }
      >
        {formatPrice(finalPrice)}
      </p>
    </div>
  );
}