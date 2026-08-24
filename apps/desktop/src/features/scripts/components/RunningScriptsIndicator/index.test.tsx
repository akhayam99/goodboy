// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    scriptRuns: {
      'session-1': {
        'script-1': { status: 'pending' as const, startedAt: Date.now() },
      },
    } as Record<string, Record<string, { status: string; startedAt: number }>>,
    sessions: [{ id: 'session-1', workspaceId: 'ws-1', goal: 'ship it' }] as ReadonlyArray<{
      readonly id: string;
      readonly workspaceId: string;
      readonly goal: string;
    }>,
    projectScripts: {
      'ws-1': [{ id: 'script-1', name: 'lint' }],
    } as Record<string, ReadonlyArray<{ id: string; name: string }>>,
    setCurrentSession: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    cancelScript: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { RunningScriptsIndicator } from './index';

afterEach(cleanup);

describe('RunningScriptsIndicator', () => {
  it('opens its popover on the named z-popover layer, above a full-page studio', async () => {
    render(<RunningScriptsIndicator />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /running/i }));
    });

    expect(document.body.querySelector('.z-popover-backdrop')).not.toBeNull();
    expect(document.body.querySelector('.z-popover')).not.toBeNull();
  });

  it('closes on escape without pulling focus back to the trigger', async () => {
    render(<RunningScriptsIndicator />);
    const trigger = screen.getByRole('button', { name: /running/i });

    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(screen.getByRole('dialog', { name: 'Running scripts' })).toBeDefined();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(screen.queryByRole('dialog', { name: 'Running scripts' })).toBeNull();
    expect(document.activeElement).not.toBe(trigger);
  });

  it('closes when the backdrop is clicked', async () => {
    render(<RunningScriptsIndicator />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /running/i }));
    });
    const backdrop = document.body.querySelector('.z-popover-backdrop');
    expect(backdrop).not.toBeNull();

    await act(async () => {
      fireEvent.click(backdrop as Element);
    });

    expect(screen.queryByRole('dialog', { name: 'Running scripts' })).toBeNull();
  });

  it('lists every running script and closes when one is opened', async () => {
    render(<RunningScriptsIndicator />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /running/i }));
    });
    const panel = screen.getByRole('dialog', { name: 'Running scripts' });
    expect(within(panel).getAllByRole('listitem').length).toBe(1);

    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Go to lint in ship it' }));
    });

    expect(state.setCurrentSession).toHaveBeenCalledWith('session-1');
    expect(screen.queryByRole('dialog', { name: 'Running scripts' })).toBeNull();
  });
});
