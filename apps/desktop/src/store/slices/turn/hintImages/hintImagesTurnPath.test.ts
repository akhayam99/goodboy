// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrchestratorHint } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../storyHarness';
import {
  FIXTURE_NOW,
  RUN,
  STEP_BUILD,
  WORKSPACE,
  mountFixture,
  runFixture,
  seedActionState,
  sessionFixture,
  stepAgent,
  workflowFixture,
} from '../../../../__tests__/helpers/actionFixtures';
import { stubProviderRouting } from '../../../../__tests__/helpers/journeyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../storyHarness')).dbModuleMock());
vi.mock('../../../../features/chat/turn', async () =>
  (await import('../../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../../features/permissions/permissions', async () =>
  (await import('../../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../../features/providers/providers', async () =>
  (await import('../../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../../features/providers/routing', async () =>
  (await import('../../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../../features/budget/budget', async () =>
  (await import('../../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../../features/workflows/workflows', async () =>
  (await import('../../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../../features/worktree/worktree', async () =>
  (await import('../../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../storyHarness')).repoModuleMock(),
);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const SHOT: OrchestratorHint = {
  id: 'shot',
  text: 'remove this header',
  createdAt: FIXTURE_NOW,
  consumedAt: FIXTURE_NOW,
  consumedAtStep: 2,
  attachmentIds: ['a'],
};

const IMAGE = {
  id: 'a',
  ownerType: 'workflow_run' as const,
  ownerId: RUN,
  relPath: '.goodboy/attachments/a/a.png',
  kind: 'image' as const,
  fileName: 'a.png',
  mimeType: 'image/png',
  createdAt: FIXTURE_NOW,
};

const BUILD_AGENT = stepAgent({ id: 'agent-build', stepId: STEP_BUILD, status: 'pending' });

const sentPrompt = (): string => JSON.stringify(storySpies.runTurn.mock.calls[0]?.[0] ?? {});

beforeEach(async () => {
  await resetStoryStore();
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  await stubProviderRouting();
  stubStoryInvoke({ query_bridge_serving: false });
  const mount = mountFixture();
  const session = sessionFixture({
    workflowRuns: [runFixture({ executionMode: 'dynamic', orchestratorHints: [SHOT] })],
  });
  const agent = BUILD_AGENT;
  storySpies.invokeAgentList.mockResolvedValue([agent]);
  storySpies.invokeAgentUpdateStatus.mockResolvedValue({ ...agent, status: 'running' });
  seedActionState({ useAppStore, seed: { session, agents: [agent], mounts: [mount] } });
  useAppStore.setState({
    phaseTemplates: { [WORKSPACE]: [workflowFixture()] },
    selectedAgentId: { [session.id]: agent.id },
    ...connectedAnthropicState(),
  });
});

describe('story: a first step turn carries the hint images', () => {
  it('lists the images on the first turn of the step the hint was read for', async () => {
    useAppStore.setState({ workflowRunAttachments: { [RUN]: [IMAGE] } });

    await useAppStore.getState().sendTurn({
      sessionId: sessionFixture().id,
      agentId: BUILD_AGENT.id,
      content: 'go',
      origin: 'workflow',
    });

    expect(sentPrompt()).toContain("Images from the user's hint: remove this header");
    expect(sentPrompt()).toContain('/.goodboy/attachments/a/a.png');
  });

  it('loads the run attachments a restart left unloaded before it looks for the images', async () => {
    const db = await import('@goodboy/db');
    vi.mocked(db.listGoalAttachmentsForRun).mockResolvedValue([IMAGE]);

    await useAppStore.getState().sendTurn({
      sessionId: sessionFixture().id,
      agentId: BUILD_AGENT.id,
      content: 'go',
      origin: 'workflow',
    });

    expect(sentPrompt()).toContain('/.goodboy/attachments/a/a.png');
  });
});
