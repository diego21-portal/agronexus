import type { AdminListPage } from "../../services/adminService";

interface AdminPaginationProps {
  data: AdminListPage<unknown>;
  headingId: string;
  onPage: (page: number) => void;
  disabled?: boolean;
}

export function AdminPagination({ data, headingId, onPage, disabled }: AdminPaginationProps) {
  const buttonClass = "min-h-11 rounded-lg border border-agro-control bg-white px-3 font-semibold text-agro-forest disabled:border-agro-line disabled:text-agro-muted";

  function changePage(page: number) {
    document.getElementById(headingId)?.focus();
    onPage(page);
  }

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-agro-line pt-4 text-sm">
      <p className="text-agro-muted">{data.count} {data.count === 1 ? "registro" : "registros"}</p>
      {(data.previous || data.next) && (
        <nav aria-label="Páginas del listado" className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={disabled || !data.previous} onClick={() => changePage(data.page - 1)} className={buttonClass}>
            Anterior
          </button>
          <span className="px-1">Página {data.page}</span>
          <button type="button" disabled={disabled || !data.next} onClick={() => changePage(data.page + 1)} className={buttonClass}>
            Siguiente
          </button>
        </nav>
      )}
    </div>
  );
}
