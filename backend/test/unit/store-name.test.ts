import { describe, expect, it } from 'vitest';
import { slugifyStoreName, validateStoreName } from '../../src/modules/seller/store-name.js';

describe('store name', () => {
  it('slugifies to lowercase dashes', () => {
    expect(slugifyStoreName('  Ali & Sons Traders!! ')).toBe('ali-sons-traders');
  });
  it('collapses repeated separators and trims dashes', () => {
    expect(slugifyStoreName('--Hello___World--')).toBe('hello-world');
  });
  it('rejects names shorter than 3 or longer than 60 characters', () => {
    expect(validateStoreName('ab').ok).toBe(false);
    expect(validateStoreName('x'.repeat(61)).ok).toBe(false);
    expect(validateStoreName('abc').ok).toBe(true);
  });
  it('rejects names that produce an empty slug', () => {
    expect(validateStoreName('!!!!').ok).toBe(false);
  });
  it('rejects reserved slugs', () => {
    expect(validateStoreName('Admin').ok).toBe(false);
    expect(validateStoreName('QCS Store').ok).toBe(false);
  });
});
