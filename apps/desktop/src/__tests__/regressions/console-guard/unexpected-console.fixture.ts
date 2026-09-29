import { describe, expect, it, vi } from 'vitest';

describe('console guard fixture', () => {
  it('logs output that is not in the baseline', () => {
    console.error('unexpected fixture error 42');
    expect(1).toBe(1);
  });

  it('warns about output that is not in the baseline', () => {
    console.warn('unexpected fixture warning');
    expect(1).toBe(1);
  });

  it('stays quiet', () => {
    expect(1).toBe(1);
  });

  it('may spy on the console itself and log through the spy', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    console.error('handled by the test');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
