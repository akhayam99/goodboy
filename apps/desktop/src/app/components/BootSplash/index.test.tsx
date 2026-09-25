// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../../../shared/lib/editor', () => ({
  openInEditor: vi.fn(),
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootSplash, bootErrorCategory } from './index';
import { DATABASE_UNAVAILABLE_MESSAGE } from '../../../shared/lib/db';
import { openUrl } from '../../../shared/lib/editor';

describe('BootSplash slow boot recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('keeps the normal splash unchanged below the slow threshold', () => {
    render(<BootSplash phase="loading-settings" error={null} />);

    act(() => {
      vi.advanceTimersByTime(9_000);
    });

    expect(screen.queryByText('this is taking longer than usual')).toBeNull();
    expect(screen.queryByRole('button', { name: /restart/i })).toBeNull();
  });

  it('offers restart after the phase takes longer than usual', () => {
    const onRetry = vi.fn();
    render(<BootSplash phase="detecting-cli" error={null} onRetry={onRetry} />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByText('this is taking longer than usual')).toBeDefined();
    expect(screen.getByText('10s in this step')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /restart/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('acknowledges the restart press instead of leaving the button dead', () => {
    render(<BootSplash phase="detecting-cli" error={null} onRetry={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    fireEvent.click(screen.getByRole('button', { name: /restart/i }));

    expect(screen.getByText('still working, give it a moment')).toBeDefined();
    expect(screen.queryByRole('button', { name: /restart/i })).toBeNull();
  });

  it('resets the escalation when the phase changes', () => {
    const { rerender } = render(
      <BootSplash phase="loading-settings" error={null} onRetry={vi.fn()} />,
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    rerender(<BootSplash phase="detecting-cli" error={null} onRetry={vi.fn()} />);

    expect(screen.queryByText('this is taking longer than usual')).toBeNull();
    expect(screen.queryByRole('button', { name: /restart/i })).toBeNull();
  });
});

describe('BootSplash boot handoff', () => {
  afterEach(() => {
    cleanup();
  });

  it('removes the static boot shell once react takes over', () => {
    document.body.insertAdjacentHTML('afterbegin', '<div id="boot-shell"></div>');
    render(<BootSplash phase="migrating" error={null} />);
    expect(document.getElementById('boot-shell')).toBeNull();
  });

  it('renders the bare mascot mark without a circle tile', () => {
    const { container } = render(<BootSplash phase="restoring-session" error={null} />);

    const mark = container.querySelector('span[aria-hidden]');
    expect(mark).not.toBeNull();
    expect(container.querySelector('.rounded-full')).toBeNull();
    expect(container.querySelector('.bg-subtle')).toBeNull();
  });

  it('offers retry on the error screen', () => {
    const onRetry = vi.fn();
    render(<BootSplash phase="migrating" error="boom" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('puts an unopenable database in front of a window, named and categorised', () => {
    render(<BootSplash phase="error" error={DATABASE_UNAVAILABLE_MESSAGE} onRetry={vi.fn()} />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Database failed')).toBeDefined();
    expect(screen.getByText(/~\/\.goodboy\/data\.db is moved aside/)).toBeDefined();
  });

  it('offers no retry for a database that cannot be reopened', () => {
    render(<BootSplash phase="error" error={DATABASE_UNAVAILABLE_MESSAGE} onRetry={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    expect(screen.getByRole('button', { name: /report on github/i })).toBeDefined();
  });
});

describe('BootSplash issue report', () => {
  afterEach(cleanup);

  it('keeps the home path out of the issue link', () => {
    render(
      <BootSplash
        phase="migrating"
        error="cannot open /Users/dev/.goodboy/data.db"
        onRetry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /report on github/i }));

    const url = String(vi.mocked(openUrl).mock.calls.at(-1)?.[0]);
    expect(decodeURIComponent(url)).toContain('cannot open ~/.goodboy/data.db');
    expect(decodeURIComponent(url)).not.toContain('/Users/dev');
  });
});

describe('BootSplash failed phase', () => {
  afterEach(cleanup);

  it('names the phase that failed, not the error phase itself', () => {
    render(
      <BootSplash phase="error" failedPhase="loading-workspaces" error="boom" onRetry={vi.fn()} />,
    );

    expect(screen.getByText('Workspace load failed')).toBeDefined();
    expect(screen.queryByText('Init failed')).toBeNull();
  });
});

describe('BootSplash newer database', () => {
  afterEach(cleanup);

  const snapshot = '/tmp/data.db.pre-m174-from-m173-20260901T120000000Z.bak';

  it('blocks the window and offers the backup or quitting', async () => {
    const onRestoreBackup = vi.fn(async () => undefined);
    const onQuit = vi.fn();
    render(
      <BootSplash
        phase="error"
        failedPhase="migrating"
        error="newer"
        newerDatabase={{ restorableSnapshot: snapshot }}
        onRetry={vi.fn()}
        onRestoreBackup={onRestoreBackup}
        onQuit={onQuit}
      />,
    );

    expect(screen.getByText('This database was upgraded by a newer Goodboy.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Quit' }));
    expect(onQuit).toHaveBeenCalledOnce();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restore backup' }));
    });
    expect(onRestoreBackup).toHaveBeenCalledOnce();
  });

  it('only offers quitting when no backup can be read by this build', () => {
    render(
      <BootSplash
        phase="error"
        error="newer"
        newerDatabase={{ restorableSnapshot: null }}
        onQuit={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Restore backup' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Quit' })).toBeDefined();
  });

  it('keeps the screen and says why when the restore fails', async () => {
    render(
      <BootSplash
        phase="error"
        error="newer"
        newerDatabase={{ restorableSnapshot: snapshot }}
        onRestoreBackup={async () => {
          throw new Error('disk full');
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restore backup' }));
    });

    expect(screen.getByText(/The backup could not be restored/)).toBeDefined();
  });
});

describe('bootErrorCategory', () => {
  it('names the database ahead of whichever phase was running', () => {
    expect(bootErrorCategory({ phase: 'migrating', isDatabaseFailure: true })).toBe('database');
  });

  it('keeps the phase category when the database opened fine', () => {
    expect(bootErrorCategory({ phase: 'migrating', isDatabaseFailure: false })).toBe('migration');
    expect(bootErrorCategory({ phase: 'error', isDatabaseFailure: false })).toBe('init');
  });
});
