import { describe, it, expect } from 'vitest';
import { encodeId, decodeId, parseIdentifier } from './short-id.util.js';

describe('short-id.util', () => {
  // ─── encodeId ──────────────────────────────────────────────────────

  describe('encodeId()', () => {
    it('should encode 0 to "0"', () => {
      expect(encodeId(0)).toBe('0');
    });

    it('should encode 1 to "1"', () => {
      expect(encodeId(1)).toBe('1');
    });

    it('should encode 9 to "9"', () => {
      expect(encodeId(9)).toBe('9');
    });

    it('should encode 10 to "a"', () => {
      expect(encodeId(10)).toBe('a');
    });

    it('should encode 35 to "z"', () => {
      expect(encodeId(35)).toBe('z');
    });

    it('should encode 36 to "A"', () => {
      expect(encodeId(36)).toBe('A');
    });

    it('should encode 61 to "Z"', () => {
      expect(encodeId(61)).toBe('Z');
    });

    it('should encode 62 to "10" (base62 overflow)', () => {
      expect(encodeId(62)).toBe('10');
    });

    it('should encode 3844 to "100" (62^2)', () => {
      expect(encodeId(3844)).toBe('100');
    });

    it('should encode larger integers correctly', () => {
      // 238328 = 62^3
      expect(encodeId(238328)).toBe('1000');
    });

    it('should handle negative numbers as 0', () => {
      expect(encodeId(-5)).toBe('0');
      expect(encodeId(-100)).toBe('0');
    });

    it('should roundtrip with decodeId for small integers', () => {
      const testValues = [1, 10, 42, 61, 62, 100, 999, 3844];
      testValues.forEach((val) => {
        const encoded = encodeId(val);
        const decoded = decodeId(encoded);
        expect(decoded).toBe(val);
      });
    });

    it('should roundtrip with decodeId for large integers', () => {
      const testValues = [100000, 238328, 1000000, 9999999];
      testValues.forEach((val) => {
        const encoded = encodeId(val);
        const decoded = decodeId(encoded);
        expect(decoded).toBe(val);
      });
    });
  });

  // ─── decodeId ──────────────────────────────────────────────────────

  describe('decodeId()', () => {
    it('should decode "0" to null', () => {
      expect(decodeId('0')).toBeNull();
    });

    it('should decode "1" to 1', () => {
      expect(decodeId('1')).toBe(1);
    });

    it('should decode "9" to 9', () => {
      expect(decodeId('9')).toBe(9);
    });

    it('should decode "a" to 10', () => {
      expect(decodeId('a')).toBe(10);
    });

    it('should decode "z" to 35', () => {
      expect(decodeId('z')).toBe(35);
    });

    it('should decode "A" to 36', () => {
      expect(decodeId('A')).toBe(36);
    });

    it('should decode "Z" to 61', () => {
      expect(decodeId('Z')).toBe(61);
    });

    it('should decode "10" to 62', () => {
      expect(decodeId('10')).toBe(62);
    });

    it('should decode "100" to 3844', () => {
      expect(decodeId('100')).toBe(3844);
    });

    it('should decode multi-char codes correctly', () => {
      expect(decodeId('1000')).toBe(238328);
    });

    it('should return null for empty string', () => {
      expect(decodeId('')).toBeNull();
    });

    it('should return null for codes longer than 8 chars', () => {
      expect(decodeId('123456789')).toBeNull();
    });

    it('should return null for invalid characters', () => {
      expect(decodeId('!@#')).toBeNull();
      expect(decodeId('abc-def')).toBeNull();
      expect(decodeId('abc def')).toBeNull();
    });

    it('should return null for special characters', () => {
      expect(decodeId('+')).toBeNull();
      expect(decodeId('/')).toBeNull();
      expect(decodeId('_')).toBeNull();
    });

    it('should return null for mixed case issues (if applicable)', () => {
      // Verify case sensitivity works correctly
      expect(decodeId('a')).not.toEqual(decodeId('A'));
    });

    it('should roundtrip with encodeId', () => {
      const testValues = [1, 42, 999, 100000, 9999999];
      testValues.forEach((val) => {
        const encoded = encodeId(val);
        const decoded = decodeId(encoded);
        expect(decoded).toBe(val);
      });
    });
  });

  // ─── parseIdentifier ───────────────────────────────────────────────

  describe('parseIdentifier()', () => {
    it('should parse shortId-slug format (e.g. "1-one-piece")', () => {
      const result = parseIdentifier('1-one-piece');
      expect(result).toEqual({ type: 'id', value: 1 });
    });

    it('should parse encoded shortId-slug format', () => {
      const encoded = encodeId(123);
      const result = parseIdentifier(`${encoded}-test-manga`);
      expect(result).toEqual({ type: 'id', value: 123 });
    });

    it('should parse longer slug after shortId', () => {
      const result = parseIdentifier('10-very-long-manga-slug-here');
      expect(result).toEqual({ type: 'id', value: 62 });
    });

    it('should fallback to bare shortId when no dash present', () => {
      const result = parseIdentifier('1');
      expect(result).toEqual({ type: 'id', value: 1 });
    });

    it('should fallback to bare shortId for valid encoded ID without slug', () => {
      const encoded = encodeId(42);
      const result = parseIdentifier(encoded);
      expect(result).toEqual({ type: 'id', value: 42 });
    });

    it('should treat long prefixes (>5 chars) as slug, not shortId', () => {
      // "invalid" is 7 chars — exceeds MAX_SHORT_ID_LEN, treated as legacy slug
      const result = parseIdentifier('invalid-prefix-slug');
      expect(result).toEqual({ type: 'slug', value: 'invalid-prefix-slug' });
    });

    it('should parse short prefix (<=5 chars) as shortId', () => {
      // "abc" is 3 chars, valid base62 — decoded as shortId
      const result = parseIdentifier('abc-some-manga');
      expect(result.type).toBe('id');
    });

    it('should fallback to slug when prefix with dash has no valid base62 decode', () => {
      // Use a string with special char that clearly won't decode
      const result = parseIdentifier('!@#-test-manga');
      expect(result).toEqual({ type: 'slug', value: '!@#-test-manga' });
    });

    it('should parse bare slug with alphanumeric dashes as ID when it decodes as base62', () => {
      // "one-piece" contains valid base62 chars, so decodes to a number
      const result = parseIdentifier('one-piece');
      expect(result.type).toBe('id');
      expect(typeof result.value).toBe('number');
    });

    it('should handle slug with special characters that prevent base62 decode', () => {
      // String with special chars that aren't in base62 alphabet
      const result = parseIdentifier('!@#$%-season-2');
      expect(result).toEqual({ type: 'slug', value: '!@#$%-season-2' });
    });

    it('should return slug when param has dash at start (invalid prefix)', () => {
      const result = parseIdentifier('-invalid-slug');
      expect(result).toEqual({ type: 'slug', value: '-invalid-slug' });
    });

    it('should correctly identify "0" prefix as invalid (null decodes to null)', () => {
      const result = parseIdentifier('0-some-manga');
      // "0" decodes to null, so falls through to slug
      expect(result).toEqual({ type: 'slug', value: '0-some-manga' });
    });

    it('should parse encoded IDs with large values', () => {
      const encoded = encodeId(1000000);
      const result = parseIdentifier(`${encoded}-large-id-manga`);
      expect(result.type).toBe('id');
      expect(result.value).toBe(1000000);
    });

    it('should handle edge case: very short slug (single char)', () => {
      const result = parseIdentifier('a');
      expect(result).toEqual({ type: 'id', value: 10 });
    });

    it('should handle edge case: slug starting with number but not shortId pattern', () => {
      const result = parseIdentifier('123invalid');
      // "123invalid" is not a valid decode (contains 'i'), should be slug
      expect(result).toEqual({ type: 'slug', value: '123invalid' });
    });
  });
});
