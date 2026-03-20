import { describe, it, expect } from 'vitest';
import { PaginationDto } from './pagination.dto.js';

describe('PaginationDto', () => {
  it('should have default page=1 and limit=20', () => {
    const dto = new PaginationDto();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('should calculate offset correctly', () => {
    const dto = new PaginationDto();
    dto.page = 3;
    dto.limit = 10;
    expect(dto.offset).toBe(20);
  });
});
