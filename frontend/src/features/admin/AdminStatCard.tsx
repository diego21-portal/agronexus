interface AdminStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

export function AdminStatCard({
  title,
  value,
  subtitle,
}: AdminStatCardProps) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold">
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