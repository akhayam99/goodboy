// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    settings: {} as Record<string, string>,
    loadSetting: vi.fn(async (_key: string) => null as string | null),
    saveSetting: vi.fn(async (_key: string, _value: string) => undefined),
    reportError: vi.fn(),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T>(selector: (state: typeof store) => T) => selector(store),
}));

import { useChatDefaultModel } from './index';

const WORKSPACE = 'ws-1' as WorkspaceId;
const KEY = 'chat.default_model.ws-1';

beforeEach(() => {
  store.settings = {};
  store.loadSetting.mockClear();
  store.saveSetting.mockReset();
  store.saveSetting.mockResolvedValue(undefined);
  store.reportError.mockClear();
});

describe('useChatDefaultModel', () => {
  it('loads the workspace key and reads a valid saved model', () => {
    store.settings = {
      [KEY]: JSON.stringify({ provider: 'anthropic', model: 'opus-5', effort: 'low' }),
    };

    const { result } = renderHook(() => useChatDefaultModel({ workspaceId: WORKSPACE }));

    expect(store.loadSetting).toHaveBeenCalledWith(KEY);
    expect(result.current.saved).toEqual({ provider: 'anthropic', model: 'opus-5', effort: 'low' });
  });

  it('reads a stale or broken value as no default', () => {
    store.settings = { [KEY]: JSON.stringify({ provider: 'cursor', model: 'auto' }) };

    const { result } = renderHook(() => useChatDefaultModel({ workspaceId: WORKSPACE }));

    expect(result.current.saved).toBeNull();
  });

  it('saves a routing and clears it with an empty value', () => {
    const { result } = renderHook(() => useChatDefaultModel({ workspaceId: WORKSPACE }));

    result.current.save({ routing: { provider: 'codex', model: 'gpt-5.6-sol', effort: null } });
    result.current.clear();

    expect(store.saveSetting).toHaveBeenNthCalledWith(
      1,
      KEY,
      JSON.stringify({ provider: 'codex', model: 'gpt-5.6-sol', effort: null }),
    );
    expect(store.saveSetting).toHaveBeenNthCalledWith(2, KEY, '');
  });

  it('reports a failed save', async () => {
    store.saveSetting.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useChatDefaultModel({ workspaceId: WORKSPACE }));

    result.current.clear();
    await vi.waitFor(() => expect(store.reportError).toHaveBeenCalledTimes(1));

    expect(store.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't save the default chat model" }),
    );
  });

  it('reports a failed read and falls back to no default without an unhandled rejection', async () => {
    store.loadSetting.mockRejectedValue(new Error('db locked'));

    const { result } = renderHook(() => useChatDefaultModel({ workspaceId: WORKSPACE }));
    await vi.waitFor(() => expect(store.reportError).toHaveBeenCalledTimes(1));

    expect(store.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't read the default chat model" }),
    );
    expect(result.current.saved).toBeNull();
    await expect(result.current.read()).resolves.toBeNull();
  });

  it('read waits for the database when the cache is cold', async () => {
    store.loadSetting.mockResolvedValue(
      JSON.stringify({ provider: 'anthropic', model: 'opus-5', effort: 'low' }),
    );
    const { result } = renderHook(() => useChatDefaultModel({ workspaceId: WORKSPACE }));

    await expect(result.current.read()).resolves.toEqual({
      provider: 'anthropic',
      model: 'opus-5',
      effort: 'low',
    });
  });
});
