export declare class PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export declare class ApiResponseDto<T = unknown> {
    success: boolean;
    data: T;
    message: string;
    meta?: PaginationMeta;
}
