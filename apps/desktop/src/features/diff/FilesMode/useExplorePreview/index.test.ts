// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { useExplorePreview } from '.';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const entryOf = (name: string) => ({
  name,
  relPath: name,
  isDir: false,
  sizeBytes: 12,
  modifiedAt: null,
});

afterEach(() => {
  cleanup();
  vi.mocked(invoke).mockReset();
});

describe('useExplorePreview', () => {
  it('asks the backend about an office extension and shows what it answers', async () => {
    vi.mocked(invoke).mockResolvedValue({ type: 'binary', size: 4096 });

    const { result } = renderHook(() =>
      useExplorePreview({ sessionDir: '/work/harborline', entry: entryOf('ledger-report.xlsx') }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      status: 'ready',
      content: { type: 'binary', size: 4096 },
    });
  });

  it('reads a text file that carries an office extension as text', async () => {
    vi.mocked(invoke).mockResolvedValue({ type: 'text', text: 'a,b', truncated: false });

    const { result } = renderHook(() =>
      useExplorePreview({ sessionDir: '/work/harborline', entry: entryOf('export.numbers') }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toEqual({
      status: 'ready',
      content: { type: 'text', text: 'a,b', truncated: false },
    });
  });
});
