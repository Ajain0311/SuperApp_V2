export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  errors?: string[];
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
}
