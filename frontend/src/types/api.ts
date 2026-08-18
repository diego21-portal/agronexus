export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type ListResponse<T> = T[] | PaginatedResponse<T>;

export function extractResults<T>(data: ListResponse<T>): T[] {
  return Array.isArray(data) ? data : data.results;
}