import { useCallback, useEffect, useState } from "react";
import type { AdminListFilters, AdminListPage, AdminListQuery } from "../../services/adminService";
import { useAdminResource } from "./useAdminResource";

export function useAdminList<T>(
  fetchPage: (params: AdminListQuery, signal: AbortSignal) => Promise<AdminListPage<T>>,
  loadError: string,
  filters: AdminListFilters = {},
) {
  const text = filters.search?.trim() ?? "";
  const [search, setSearch] = useState(text);
  const { role, status } = filters;
  const waitingForSearch = search !== text;

  useEffect(() => {
    if (!waitingForSearch) return;
    const timer = window.setTimeout(() => setSearch(text), 250);
    return () => window.clearTimeout(timer);
  }, [text, waitingForSearch]);

  const filterKey = JSON.stringify([search, role, status]);
  const [position, setPosition] = useState({ filterKey, page: 1 });
  const page = position.filterKey === filterKey ? position.page : 1;

  useEffect(() => {
    setPosition((current) => current.filterKey === filterKey ? current : { filterKey, page: 1 });
  }, [filterKey]);

  const load = useCallback((signal: AbortSignal) => fetchPage({
    page, search: search || undefined, role: role || undefined, status: status || undefined,
  }, signal), [fetchPage, page, search, role, status]);
  const resource = useAdminResource(load, loadError, `${filterKey}:${page}`);

  return {
    ...resource,
    data: waitingForSearch ? null : resource.data,
    loading: waitingForSearch || resource.loading,
    error: waitingForSearch ? "" : resource.error,
    changePage: (next: number) => setPosition({ filterKey, page: next }),
  };
}
