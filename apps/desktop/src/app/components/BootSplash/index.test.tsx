// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../../../shared/lib/editor', () => ({
  openInEditor: vi.fn(),
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootSplash, bootErrorCategory } from './index';
import {
  SPLASH_TILE_CENTER_ABOVE_MIDDLE_PX,
  SPLASH_TILE_PX,
  splashShift,
} from '../../../features/onboarding/OnboardingWizard/useSplashAnchor/splashShift';
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

  it('draws the 84px brand tile and the name, with no tagline', () => {
    const { container } = render(<BootSplash phase="restoring-session" error={null} />);

    const tile = container.querySelector<HTMLElement>('[data-brand-tile]');
    expect(tile?.style.width).toBe('84px');
    expect(screen.getByText('Goodboy')).toBeDefined();
    expect(screen.queryByText(/workspace orchestrator/)).toBeNull();
  });

  it('puts the tile where the Welcome tile lands', () => {
    render(<BootSplash phase="migrating" error={null} />);

    const stack = screen.getByTestId('boot-splash-stack');
    const tileCenterAbove = SPLASH_TILE_CENTER_ABOVE_MIDDLE_PX;
    expect(stack.style.top).toBe(`calc(50% - ${tileCenterAbove + SPLASH_TILE_PX / 2}px)`);
    expect(splashShift({ markCenter: 0, blockBottom: 0, viewportHeight: 900 })).toBe(
      900 / 2 - tileCenterAbove,
    );
  });
});

const BOOT_PHASES = [
  'pending',
  'migrating',
  'loading-settings',
  'detecting-cli',
  'loading-workspaces',
  'restoring-session',
  'ready',
] as const;

describe('BootSplash progress bar', () => {
  afterEach(cleanup);

  const fillWidth = (): string => screen.getByTestId('boot-progress-fill').style.width;

  it('steps one sixth per real boot phase and never reads the clock', () => {
    vi.useFakeTimers();
    const { rerender } = render(<BootSplash phase="pending" error={null} />);
    expect(fillWidth()).toBe('0%');

    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(fillWidth()).toBe('0%');
    vi.useRealTimers();

    const widths = BOOT_PHASES.map((phase) => {
      rerender(<BootSplash phase={phase} error={null} />);
      return Number.parseFloat(fillWidth());
    });
    const steps = widths.slice(1).map((width, index) => width - (widths[index] ?? 0));
    steps.forEach((step) => expect(step).toBeCloseTo(100 / 6, 6));
    expect(widths.at(-1)).toBe(100);
  });

  it('reports the phase word and the progress to assistive tech', () => {
    render(<BootSplash phase="detecting-cli" error={null} />);

    expect(screen.getByText('detecting agents')).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
  });

  it('animates the fill only when motion is allowed, so reduced motion jumps', () => {
    render(<BootSplash phase="migrating" error={null} />);

    const classes = screen.getByTestId('boot-progress-fill').className.split(' ');
    expect(classes).toContain('motion-safe:transition-[width]');
    expect(classes).not.toContain('transition-[width]');
    expect(classes.filter((name) => name.startsWith('animate-'))).toEqual([]);
  });
});

describe('BootSplash finish', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const stubReducedMotion = ({ isReduced }: { readonly isReduced: boolean }) => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: isReduced })),
    );
  };

  it('lets the bar fill before it reports finished', () => {
    stubReducedMotion({ isReduced: false });
    const onFinished = vi.fn();
    render(<BootSplash phase="ready" error={null} onFinished={onFinished} />);

    expect(screen.getByTestId('boot-progress-fill').style.width).toBe('100%');
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(onFinished).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it('reports finished once even when the callback identity changes', () => {
    stubReducedMotion({ isReduced: false });
    const onFinished = vi.fn();
    const { rerender } = render(<BootSplash phase="ready" error={null} onFinished={onFinished} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender(<BootSplash phase="ready" error={null} onFinished={() => onFinished()} />);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('does not finish when the phase leaves ready before the bar fills', () => {
    stubReducedMotion({ isReduced: false });
    const onFinished = vi.fn();
    const { rerender } = render(<BootSplash phase="ready" error={null} onFinished={onFinished} />);
    rerender(<BootSplash phase="error" error="boom" onFinished={onFinished} />);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(onFinished).not.toHaveBeenCalled();
  });

  it('finishes at once under reduced motion', () => {
    stubReducedMotion({ isReduced: true });
    const onFinished = vi.fn();
    render(<BootSplash phase="ready" error={null} onFinished={onFinished} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(onFinished).toHaveBeenCalledOnce();
  });
});

describe('BootSplash error screens', () => {
  afterEach(cleanup);

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
    expect(screen.getByRole('button', { name: 'Report this' })).toBeDefined();
  });
});

describe('BootSplash issue report', () => {
  afterEach(cleanup);

  const openSheet = async ({ error }: { readonly error: string }) => {
    render(<BootSplash phase="migrating" error={error} onRetry={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Report this' }));
    const sheet = await screen.findByRole('dialog', { name: 'Report this startup error' });
    await screen.findByRole('button', { name: /open on github/i });
    return sheet;
  };

  const sentText = (): string => {
    fireEvent.click(screen.getByRole('button', { name: /what gets sent/i }));
    return screen.getByLabelText('What gets sent', { selector: 'pre' }).textContent ?? '';
  };

  it('opens the report sheet inline with the startup error attached', async () => {
    await openSheet({ error: 'boom' });

    expect(screen.getByRole('textbox', { name: /one line/i })).toHaveProperty(
      'value',
      'Startup failed: migration',
    );
    expect(screen.getByText('Error and stack')).toBeDefined();
  });

  it('keeps the home path, secrets, emails and link queries out of what gets sent', async () => {
    await openSheet({
      error:
        'cannot open /Users/dev/.goodboy/data.db then sync https://api.github.com/graphql?access_token=abc123def456 for rowan@example.dev with ghp_AbCdEfGhIjKlMnOpQrSt1234',
    });

    const sent = sentText();
    expect(sent).toContain('cannot open ~/…/data.db');
    expect(sent).toContain('sync https://api.github.com/… for');
    for (const leak of ['/Users/dev', 'access_token', 'rowan@example.dev', 'ghp_AbCd']) {
      expect(sent).not.toContain(leak);
    }
  });

  it('cuts a runaway error so the link stays inside the length the shell will open', async () => {
    await openSheet({ error: 'e'.repeat(20000) });
    fireEvent.click(screen.getByRole('button', { name: /open on github/i }));

    await vi.waitFor(() => expect(vi.mocked(openUrl)).toHaveBeenCalled());
    const url = String(vi.mocked(openUrl).mock.calls.at(-1)?.[0]);
    expect(url.length).toBeLessThanOrEqual(4096);
    expect(url).not.toContain('template=');
    expect(decodeURIComponent(url)).toContain('It is on your clipboard');
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
