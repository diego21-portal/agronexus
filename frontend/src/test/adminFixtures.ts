import type { AdminListPage } from "../services/adminService";

export function adminListResponse<T>(results: T[], metadata: Partial<Omit<AdminListPage<T>, "results">> = {}) {
  return { data: { results, count: results.length, next: null, previous: null, page: 1, ...metadata } };
}
