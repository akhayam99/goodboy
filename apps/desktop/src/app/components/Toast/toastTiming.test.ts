import { describe, expect, it } from 'vitest';
import { TOAST_ACTION_DURATION_MS, TOAST_DURATION_MS, toastDuration } from './toastTiming';

describe('toastDuration', () => {
  it('gives a plain toast five seconds', () => {
    expect(toastDuration({ persist: false, hasAction: false })).toBe(TOAST_DURATION_MS);
  });

  it('gives a toast with an action ten seconds', () => {
    expect(toastDuration({ persist: false, hasAction: true })).toBe(TOAST_ACTION_DURATION_MS);
  });

  it('never dismisses a persisted preview on its own', () => {
    expect(toastDuration({ persist: true, hasAction: false })).toBeNull();
    expect(toastDuration({ persist: true, hasAction: true })).toBeNull();
  });
});
