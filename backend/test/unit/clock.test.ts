import { describe, expect, it } from 'vitest';
import { FixedClock, SystemClock } from '../../src/shared/clock.js';

describe('Clock', () => {
  it('FixedClock returns its time until advanced', () => {
    const clock = new FixedClock(new Date('2026-11-01T00:00:00Z'));
    expect(clock.now().toISOString()).toBe('2026-11-01T00:00:00.000Z');
    clock.advanceMs(1000);
    expect(clock.now().toISOString()).toBe('2026-11-01T00:00:01.000Z');
  });
  it('FixedClock hands out copies so callers cannot mutate it', () => {
    const clock = new FixedClock(new Date('2026-11-01T00:00:00Z'));
    clock.now().setFullYear(2000);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });
  it('SystemClock is close to real time', () => {
    expect(Math.abs(new SystemClock().now().getTime() - Date.now())).toBeLessThan(1000);
  });
});
