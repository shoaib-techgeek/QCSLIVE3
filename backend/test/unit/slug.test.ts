import { describe, expect, it } from 'vitest';
import { productSlug, slugify } from '../../src/shared/slug.js';

describe('slugify', () => {
  it('lowercases, strips accents and collapses separators', () => {
    expect(slugify('  Café & Co. --  Shop!! ')).toBe('cafe-co-shop');
  });
  it('truncates without leaving a trailing dash', () => {
    const s = slugify(`${'a'.repeat(58)} bbbb`, 60);
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith('-')).toBe(false);
  });
  it('returns an empty string when nothing usable remains', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('productSlug', () => {
  it('adds a short unique suffix so equal titles never collide', () => {
    expect(productSlug('Steel Bottle 750 ml', 'k3f9')).toBe('steel-bottle-750-ml-k3f9');
  });
  it('falls back to "product" for titles with no usable characters', () => {
    expect(productSlug('!!!', 'k3f9')).toBe('product-k3f9');
  });
});
