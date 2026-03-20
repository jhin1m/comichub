import { describe, it, expect } from 'vitest';
import { slugify } from './slug.util.js';

describe('slugify', () => {
  it('should convert text to slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('should strip special characters', () => {
    expect(slugify('One Piece: Chapter 1000!')).toBe('one-piece-chapter-1000');
  });

  it('should trim whitespace', () => {
    expect(slugify('  spaced  ')).toBe('spaced');
  });
});
