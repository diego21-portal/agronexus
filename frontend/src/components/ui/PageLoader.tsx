export function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[300px] items-center justify-center"
    >
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-700" />

        <p className="mt-4 text-sm font-medium text-gray-500">
          Cargando AgroNexus...
        </p>
      </div>
    </div>
  );
}