// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, ProviderRunId, TelemetryRecordId } from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { OverviewEmpty } from './OverviewEmpty';
import { overviewEmptyTitle } from './overviewEmptyTitle';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const seedSpend = ({ usd }: { readonly usd: number }): void => {
  const workspace = aWorkspace({ name: 'Harborline' });
  const session = aSession({ workspaceId: workspace.id });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    sessions: [session],
    sessionTelemetry: {
      [session.id]: [
        {
          id: 'telemetry-1' as TelemetryRecordId,
          runId: 'run-1' as ProviderRunId,
          sessionId: session.id,
          kind: 'turn',
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          recordedAt: new Date().toISOString() as IsoDateTime,
          inputTokens: 1000,
          outputTokens: 200,
          estimatedCostUsd: usd,
        },
      ],
    },
  });
};

describe('overviewEmptyTitle', () => {
  it.each([
    [0, '$0.00', 'Impact fills in as sessions finish'],
    [9.84, '$9.84', '$9.84 spent today so far. Impact fills in as sessions finish.'],
  ])(
    'with %d spent today it reads the same line the bar shows',
    (todaySpend, spentLabel, title) => {
      expect(overviewEmptyTitle({ todaySpend, spentLabel })).toBe(title);
    },
  );
});

describe('OverviewEmpty', () => {
  it('states the spend the top bar shows, from the same rollup', async () => {
    seedSpend({ usd: 9.84 });
    render(<OverviewEmpty onStartSession={vi.fn()} />);
    await act(async () => undefined);

    expect(
      screen.getByRole('heading', {
        name: '$9.84 spent today so far. Impact fills in as sessions finish.',
      }),
    ).toBeDefined();
  });

  it('keeps the plain line with no spend and still offers a session', async () => {
    const onStartSession = vi.fn();
    render(<OverviewEmpty onStartSession={onStartSession} />);
    await act(async () => undefined);

    expect(
      screen.getByRole('heading', { name: 'Impact fills in as sessions finish' }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start a session' }));
    expect(onStartSession).toHaveBeenCalledOnce();
  });
});
