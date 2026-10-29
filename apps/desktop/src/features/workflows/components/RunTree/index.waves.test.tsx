// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type ImplementationCluster,
  type PlanWithCount,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { aPlan } from '../../../../test/planFixtures';
import { RunTreeHarness } from './testing/RunTreeHarness';
import { SESSION_ID, WORKSPACE_ID, baseAgents, scouts, workflow } from './testing/runTreeFixtures';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

const CONSUMER = brandId<AgentId>({ value: 'implement' });

const PARALLEL: ReadonlyArray<ImplementationCluster> = [
  { title: 'Ledger view', instructions: 'x', touches: ['ledger-core/src/view.ts'] },
  { title: 'Relay hook', instructions: 'x', touches: ['notify-relay/src/hook.ts'] },
  { title: 'Relay test', instructions: 'x', touches: ['notify-relay/src/hook.ts'] },
];

const CHAIN: ReadonlyArray<ImplementationCluster> = [
  { title: 'A', instructions: 'x', id: 'a', touches: ['src/a'] },
  { title: 'B', instructions: 'x', id: 'b', after: ['a'], touches: ['src/b'] },
  { title: 'C', instructions: 'x', id: 'c', after: ['b'], touches: ['src/c'] },
];

let useAppStore: StoryStore;

const planOf = ({
  clusters,
}: {
  readonly clusters: ReadonlyArray<ImplementationCluster>;
}): PlanWithCount =>
  aPlan({
    sessionId: SESSION_ID,
    status: 'consumed',
    consumptionCount: 1,
    lastConsumer: { agentId: CONSUMER, name: null },
    clusters,
  });

const seed = ({ clusters }: { readonly clusters: ReadonlyArray<ImplementationCluster> }): void => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [...baseAgents, ...scouts('running')] },
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionPlans: { [SESSION_ID]: [planOf({ clusters })] },
  });
};

const waveOf = (id: string): string | null =>
  within(screen.getByTestId(`run-tree-row-${id}`)).queryByTestId('run-tree-wave')?.textContent ??
  null;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('RunTree waves', () => {
  it('names the wave on each sub-agent that carries a part of the plan', () => {
    seed({ clusters: PARALLEL });
    render(<RunTreeHarness />);

    expect(waveOf('scout-a')).toBe('Runs first, in parallel');
    expect(waveOf('scout-b')).toBe('Runs first, in parallel');
    expect(waveOf('scout-c')).toBe('Then');
  });

  it('names no wave for parts that simply follow each other', () => {
    seed({ clusters: CHAIN });
    render(<RunTreeHarness />);

    expect(waveOf('scout-a')).toBeNull();
    expect(waveOf('scout-c')).toBeNull();
  });
});
