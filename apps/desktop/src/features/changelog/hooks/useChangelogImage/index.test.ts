// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChangelogImage } from './index';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

const themeState = vi.hoisted(() => ({ theme: 'dark' as 'dark' | 'light' }));

vi.mock('../../../../shared/lib/theme', () => ({
  useAppliedTheme: () => themeState.theme,
}));

beforeEach(() => {
  invoke.mockReset();
  themeState.theme = 'dark';
});

afterEach(() => {
  cleanup();
});

describe('useChangelogImage', () => {
  it('starts loading and resolves to ready with the data uri', async () => {
    invoke.mockResolvedValue('data:image/webp;base64,AAA=');
    const { result } = renderHook(() =>
      useChangelogImage({ version: '0.10.0', image: 'scroll-fade', variant: 'after' }),
    );

    expect(result.current.kind).toBe('loading');
    await waitFor(() => expect(result.current.kind).toBe('ready'));
    expect(result.current).toEqual({ kind: 'ready', dataUri: 'data:image/webp;base64,AAA=' });
    expect(invoke).toHaveBeenCalledWith('changelog_image', {
      version: '0.10.0',
      file: 'scroll-fade-after-dark.webp',
    });
  });

  it('is absent when the backend has nothing for that release', async () => {
    invoke.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useChangelogImage({ version: '0.10.0', image: 'scroll-fade', variant: 'after' }),
    );

    await waitFor(() => expect(result.current.kind).toBe('absent'));
  });

  it('is absent when the backend rejects, offline or otherwise', async () => {
    invoke.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() =>
      useChangelogImage({ version: '0.10.0', image: 'scroll-fade', variant: 'after' }),
    );

    await waitFor(() => expect(result.current.kind).toBe('absent'));
  });

  it('never calls the backend when disabled, such as a before variant on a New entry', () => {
    const { result } = renderHook(() =>
      useChangelogImage({
        version: '0.10.0',
        image: 'scroll-fade',
        variant: 'before',
        enabled: false,
      }),
    );

    expect(result.current).toEqual({ kind: 'absent' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('refetches with the theme-specific file name when the theme changes, keeping the shown image meanwhile', async () => {
    invoke.mockResolvedValueOnce('data:image/webp;base64,AAA=');
    invoke.mockResolvedValueOnce('data:image/webp;base64,BBB=');
    const { result, rerender } = renderHook(
      ({ theme }: { readonly theme: 'dark' | 'light' }) => {
        themeState.theme = theme;
        return useChangelogImage({ version: '0.10.0', image: 'scroll-fade', variant: 'after' });
      },
      { initialProps: { theme: 'dark' } },
    );
    await waitFor(() => expect(result.current.kind).toBe('ready'));

    act(() => {
      rerender({ theme: 'light' });
    });
    expect(result.current).toEqual({ kind: 'ready', dataUri: 'data:image/webp;base64,AAA=' });

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('changelog_image', {
        version: '0.10.0',
        file: 'scroll-fade-after-light.webp',
      }),
    );
    await waitFor(() =>
      expect(result.current).toEqual({ kind: 'ready', dataUri: 'data:image/webp;base64,BBB=' }),
    );
  });
});
