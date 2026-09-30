// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { UpdateConfirm, activeWorkCopy } from './index';

const applyUpdate = vi.fn(async () => undefined);
const focusChangelogRelease = vi.fn();
const at = '2026-09-23T10:00:00Z' as IsoDateTime;

const seed = ({ running }: { running: number }) => {
  const turnStates = Object.fromEntries(
    Array.from({ length: running }, (_, index) => [
      `agent-${index}`,
      { kind: 'running', runId: `run-${index}` as ProviderRunId, startedAt: at },
    ]),
  );
  useAppStore.setState({
    updaterStatus: 'available',
    updateVersion: '0.3.14',
    updateFailure: null,
    agentTurnState: turnStates,
    applyUpdate,
    focusChangelogRelease,
  } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('activeWorkCopy', () => {
  it('names what a restart stops', () => {
    expect(activeWorkCopy({ count: 0 })).toBe('Nothing is active.');
    expect(activeWorkCopy({ count: 1 })).toBe(
      'The active work picks up where it stopped after the restart.',
    );
    expect(activeWorkCopy({ count: 2 })).toBe(
      'The 2 pieces of active work pick up where they stopped after the restart.',
    );
  });
});

describe('UpdateConfirm', () => {
  it('counts active work in the confirmation', async () => {
    seed({ running: 2 });
    render(
      <UpdateConfirm
        trigger={({ arm }) => (
          <button type="button" onClick={arm}>
            open
          </button>
        )}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(
      screen.getByText('The 2 pieces of active work pick up where they stopped after the restart.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: "What's new" })).toBeNull();
  });

  it("focuses the release and opens the changelog from What's new", async () => {
    const onOpenChangelog = vi.fn();
    seed({ running: 0 });
    render(
      <UpdateConfirm
        onOpenChangelog={onOpenChangelog}
        trigger={({ arm }) => (
          <button type="button" onClick={arm}>
            open
          </button>
        )}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.click(screen.getByRole('button', { name: "What's new" }));
    expect(focusChangelogRelease).toHaveBeenCalledWith({ version: '0.3.14' });
    expect(onOpenChangelog).toHaveBeenCalledTimes(1);
    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it('offers a plain restart once the update is already downloaded', async () => {
    seed({ running: 0 });
    useAppStore.setState({ updaterStatus: 'ready' } as never);
    render(
      <UpdateConfirm
        trigger={({ arm }) => (
          <button type="button" onClick={arm}>
            open
          </button>
        )}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByText('Goodboy 0.3.14 is ready')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restart now' })).toBeTruthy();
  });
});
