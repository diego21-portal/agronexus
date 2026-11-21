interface Props {
  loading: boolean;
  error: string;
  empty?: boolean;
  loadingText: string;
  emptyText?: string;
  onRetry: () => void;
}

export function AdminResourceState({ loading, error, empty, loadingText, emptyText, onRetry }: Props) {
  if (loading) return <p role="status" className="mt-6 text-gray-600">{loadingText}</p>;
  if (error) return (
    <div role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
      <p>{error}</p>
      <button type="button" onClick={onRetry} className="mt-3 rounded-lg border px-4 py-2 font-medium">
        Reintentar
      </button>
    </div>
  );
  if (empty) return <p className="mt-6 rounded-xl bg-gray-50 p-6 text-gray-600">{emptyText}</p>;
  return null;
}
