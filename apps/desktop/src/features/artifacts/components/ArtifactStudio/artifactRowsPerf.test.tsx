// @vitest-environment happy-dom

const glyph = vi.hoisted(() => ({ renders: 0 }));

vi.mock('../ArtifactList/ArtifactKindGlyph', () => ({
  ArtifactKindGlyph: () => {
    glyph.renders += 1;
    return <span />;
  },
}));
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../chat/turn', async () =>
  (await import('../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../providers/providers', async () =>
  (await import('../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../providers/routing', async () =>
  (await import('../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../budget/budget', async () =>
  (await import('../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../skills/skills', async () =>
  (await import('../../../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../../../workflows/workflows', async () =>
  (await import('../../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../worktree/worktree', async () =>
  (await import('../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../../store/storyHarness')).repoModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AgentId, ArtifactId, IsoDateTime, PlanWithCount, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ArtifactStudio } from './index';

const SESSION_ID = 'session-payments' as SessionId;
const AGENT_ID = 'agent-planner' as AgentId;
const PER_GROUP = 100;

const plan = ({
  index,
  status,
}: {
  readonly index: number;
  readonly status: PlanWithCount['status'];
}): PlanWithCount => ({
  id: `artifact-${status}-${index}` as ArtifactId,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  title: `Plan ${status} ${index}`,
  bodyMd: '## Goal',
  status,
  createdAt: new Date(Date.UTC(2026, 8, 14, 10, 0, index)).toISOString() as IsoDateTime,
  updatedAt: new Date(Date.UTC(2026, 8, 14, 10, 0, index)).toISOString() as IsoDateTime,
  consumptionCount: status === 'consumed' ? 1 : 0,
});

const ready = Array.from({ length: PER_GROUP }, (_, index) => plan({ index, status: 'active' }));
const ran = Array.from({ length: PER_GROUP }, (_, index) => plan({ index, status: 'consumed' }));

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    currentSessionId: SESSION_ID,
    sessionPlans: { [SESSION_ID]: [...ready, ...ran] },
  });
});

afterEach(cleanup);

describe('artifact list with 200 artifacts', () => {
  it('redraws at most two rows when one artifact changes state', async () => {
    render(<ArtifactStudio sessionId={SESSION_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Ran 100$/ }));
    await waitFor(() =>
      expect(screen.getAllByTestId('artifact-row-frame')).toHaveLength(2 * PER_GROUP),
    );

    glyph.renders = 0;
    const changed = ready[42];
    if (changed === undefined) {
      throw new Error('seed missing');
    }
    act(() => {
      useAppStore.setState({
        sessionPlans: {
          [SESSION_ID]: [
            ...ready.filter((candidate) => candidate.id !== changed.id),
            { ...changed, status: 'consumed', consumptionCount: 1 },
            ...ran,
          ],
        },
      });
    });

    await waitFor(() => expect(screen.getByRole('button', { name: /^Ran 101$/ })).toBeDefined());
    expect(glyph.renders).toBeLessThanOrEqual(2);
    expect(screen.getAllByTestId('artifact-row-frame')).toHaveLength(2 * PER_GROUP);
  });
});
