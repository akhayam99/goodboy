// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { UpdateConfirm, runningAgentsCopy } from './index';

const installUpdate = vi.fn(async () => undefined);
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
    installUpdate,
    focusChangelogRelease,
  } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('runningAgentsCopy', () => {
  it('names what a restart stops', () => {
    expect(runningAgentsCopy({ count: 0 })).toBe('Nothing is running.');
    expect(runningAgentsCopy({ count: 1 })).toBe('Restarting stops 1 running agent.');
    expect(runningAgentsCopy({ count: 2 })).toBe('Restarting stops 2 running agents.');
  });
});

describe('UpdateConfirm', () => {
  it('counts running agents in the confirmation', async () => {
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
    expect(screen.getByText('Restarting stops 2 running agents.')).toBeTruthy();
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
    expect(installUpdate).not.toHaveBeenCalled();
  });
});
