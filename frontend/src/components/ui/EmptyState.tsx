import {
  Link,
} from "react-router";

interface EmptyStateProps {
  title: string;

  description: string;

  actionLabel?: string;

  actionTo?: string;

  icon?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionTo,
  icon = "🌱",
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <div className="text-5xl">
        {icon}
      </div>

      <h2 className="mt-4 text-xl font-bold">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-gray-600">
        {description}
      </p>

      {actionLabel &&
        actionTo && (
          <Link
            to={actionTo}
            className="mt-5 inline-block rounded-lg bg-green-700 px-5 py-2.5 font-medium text-white hover:bg-green-800"
          >
            {actionLabel}
          </Link>
        )}
    </div>
  );
}