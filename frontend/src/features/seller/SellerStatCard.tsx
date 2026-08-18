interface SellerStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

export function SellerStatCard({
  title,
  value,
  subtitle,
}: SellerStatCardProps) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>

      {subtitle && (
        <p className="mt-2 text-sm text-gray-500">
          {subtitle}
        </p>
      )}
    </article>
  );
}