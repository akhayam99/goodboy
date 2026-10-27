// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { toastDuration } from './toastTiming';

describe('toastDuration', () => {
  it('gives a plain toast five seconds', () => {
    expect(toastDuration({ persist: false, hasAction: false })).toBe(5000);
  });

  it('gives a toast with an action ten seconds', () => {
    expect(toastDuration({ persist: false, hasAction: true })).toBe(10000);
  });

  it('never dismisses a persisted preview on its own', () => {
    expect(toastDuration({ persist: true, hasAction: false })).toBeNull();
    expect(toastDuration({ persist: true, hasAction: true })).toBeNull();
  });
});
