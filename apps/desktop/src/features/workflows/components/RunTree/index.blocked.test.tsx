// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { AgentRole } from '@goodboy/types';
import type { DurationHistory } from '@goodboy/core';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { WorkTimeSource } from '../../../workTreeModel/workTimeSource';
import { RunTreeHarness } from './testing/RunTreeHarness';
import { SESSION_ID, WORKSPACE_ID, step, workflow } from './testing/runTreeFixtures';

const MINUTE_MS = 60_000;
const NOW = Date.parse('2026-08-18T10:00:00.000Z');
const ROLES: ReadonlyArray<AgentRole> = ['scout', 'implementer', 'reviewer', 'tester', 'docs'];

const HISTORY: DurationHistory = {
  steps: ROLES.flatMap((role) =>
    Array.from({ length: 8 }, (_, index) => ({
      role,
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      effort: 'high',
      activeMs: 3 * MINUTE_MS,
      costUsd: null,
      endedAtMs: NOW - index * MINUTE_MS,
    })),
  ),
  turns: [],
  everyWorkspace: { steps: [], turns: [] },
  orchestratedRuns: [],
};

const SOURCE: WorkTimeSource = {
  nowMs: NOW,
  spans: [],
  history: HISTORY,
  liveStartMs: new Map(),
  childrenOf: new Map(),
};

const seed = ({ status }: { readonly status: 'pending' | 'blocked' }): void => {
  useAppStore.setState({
    sessionPhaseRuns: {
      [SESSION_ID]: [
        step({ id: 'scout', ordinal: 1, status: 'completed' }),
        step({ id: 'implement', ordinal: 2, status: 'completed' }),
        { ...step({ id: 'review', ordinal: 3, status: 'pending' }), status },
      ],
    },
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionTelemetry: {},
    agentRunHistory: {},
    sessionWorkflows: {},
    sessionPlans: {},
    orchestratingWorkflowRuns: {},
    agentTurnState: {},
  });
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seed({ status: 'pending' });
});

afterEach(cleanup);

describe('the estimate on a step row', () => {
  it('shows what a step that has not started usually takes', () => {
    render(<RunTreeHarness source={SOURCE} />);

    within(screen.getByTestId('run-tree-row-review')).getByTestId('work-time');
  });

  it('shows none on a blocked step that never started, so it does not read as about to run', () => {
    seed({ status: 'blocked' });

    render(<RunTreeHarness source={SOURCE} />);

    const row = screen.getByTestId('run-tree-row-review');
    expect(within(row).queryByTestId('work-time')).toBeNull();
  });
});
