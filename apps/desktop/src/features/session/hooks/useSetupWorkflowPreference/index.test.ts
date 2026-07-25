// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useSetupWorkflowPreference } from './index';

const KEY = 'goodboy:session-setup-workflow';
const LEGACY_KEY = 'goodboy:new-session-setup-workflow';

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

describe('useSetupWorkflowPreference', () => {
  it('defaults to on when nothing was ever stored', () => {
    const { result } = renderHook(() => useSetupWorkflowPreference());
    expect(result.current[0]).toBe(true);
  });

  it('adopts a preference stored under the previous key', () => {
    localStorage.setItem(LEGACY_KEY, '0');
    const { result } = renderHook(() => useSetupWorkflowPreference());
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('0');
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('prefers the current key when both exist', () => {
    localStorage.setItem(LEGACY_KEY, '0');
    localStorage.setItem(KEY, '1');
    const { result } = renderHook(() => useSetupWorkflowPreference());
    expect(result.current[0]).toBe(true);
  });

  it('persists a change under the current key', () => {
    const { result } = renderHook(() => useSetupWorkflowPreference());
    act(() => {
      result.current[1](false);
    });
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('0');
  });
});
