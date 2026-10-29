// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId } from '@goodboy/types';
import type { GoalAttachment, OrchestratorHint, Project, ProjectId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import {
  FIXTURE_NOW,
  RUN,
  SESSION,
  WORKSPACE,
  runFixture,
  seedActionState,
  sessionFixture,
  stepAgent,
  workflowFixture,
} from '../../../__tests__/helpers/actionFixtures';

const { decideSpy, updateHintsSpy, listRunAttachmentsSpy } = vi.hoisted(() => ({
  decideSpy: vi.fn(),
  updateHintsSpy: vi.fn(async () => undefined),
  listRunAttachmentsSpy: vi.fn(async (): Promise<ReadonlyArray<unknown>> => []),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    updateWorkflowRunOrchestratorHints: updateHintsSpy,
    listGoalAttachmentsForRun: listRunAttachmentsSpy,
    updateWorkflowRunOrchestrationStop: vi.fn(async () => undefined),
    updateWorkflowRunOrchestrationOutcome: vi.fn(async () => undefined),
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/onboarding/onboardingSettings', async () =>
  (await import('../../storyHarness')).onboardingStoreModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../shared/lib/editor', async () =>
  (await import('../../storyHarness')).editorModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);
vi.mock('../../../features/integrations/linear/client', async () =>
  (await import('../../storyHarness')).linearClientModuleMock(),
);
vi.mock('../../../features/integrations/github/github', async () =>
  (await import('../../storyHarness')).githubModuleMock(),
);
vi.mock('@goodboy/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...original,
    OrchestratorClient: vi.fn(function () {
      return { decide: decideSpy };
    }),
  };
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.clearAllMocks();
  await resetStoryStore();
});

const NO_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  estimatedCostUsd: 0,
};

const hintFixture = (over: Partial<OrchestratorHint>): OrchestratorHint => ({
  id: 'hint',
  text: 'keep it to one PR',
  createdAt: FIXTURE_NOW,
  ...over,
});

const image = (id: string): GoalAttachment => ({
  id,
  ownerType: 'workflow_run',
  ownerId: RUN,
  relPath: `.goodboy/attachments/${id}/${id}.png`,
  kind: 'image',
  fileName: `${id}.png`,
  mimeType: 'image/png',
  createdAt: FIXTURE_NOW,
});

type SeedParams = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly projects?: ReadonlyArray<Project>;
  readonly attachments?: ReadonlyArray<GoalAttachment>;
};

const seedRun = ({ hints, projects = [], attachments = [] }: SeedParams): void => {
  const session = sessionFixture({
    workflowRuns: [
      runFixture({ executionMode: 'dynamic', autoRun: true, orchestratorHints: hints }),
    ],
  });
  seedActionState({
    useAppStore,
    seed: {
      session,
      agents: [
        stepAgent({
          id: 'agent-scout',
          stepId: workflowFixture().steps[0]!.id,
          status: 'completed',
        }),
      ],
      workflows: [workflowFixture()],
    },
  });
  useAppStore.setState({
    phaseTemplates: { [WORKSPACE]: [workflowFixture()] },
    projects: [...projects],
    sessionWorktrees: { [SESSION]: ['/work/harborline'] },
    workflowRunAttachments: { [RUN]: [...attachments] },
  });
  decideSpy.mockResolvedValueOnce({
    decision: { action: 'done', reason: 'all set' },
    usage: NO_USAGE,
    model: 'claude-haiku-4-5',
  });
};

type DecideFieldParams = {
  readonly key: 'operatorHints' | 'canReadFiles' | 'decisions';
};

const decideField = ({ key }: DecideFieldParams): unknown => {
  const input: unknown = decideSpy.mock.calls[0]?.[0];
  if (typeof input !== 'object' || input === null) {
    return undefined;
  }
  return Reflect.get(input, key);
};

const decide = () => useAppStore.getState().orchestrateNextStep(SESSION, RUN);

describe('orchestrateNextStep hints', () => {
  it('hands every hint of the run to the orchestrator, marking the new ones', async () => {
    seedRun({
      hints: [
        hintFixture({
          id: 'read',
          text: 'ignore the docs',
          consumedAt: FIXTURE_NOW,
          consumedAtStep: 1,
        }),
        hintFixture({ id: 'queued', text: 'run a reviewer first' }),
      ],
    });

    await decide();

    expect(decideField({ key: 'operatorHints' })).toContain('[since step 1] ignore the docs');
    expect(decideField({ key: 'operatorHints' })).toContain('[new] run a reviewer first');
  });

  it('gives the orchestrator the hint images as readable paths and lets it read them', async () => {
    seedRun({
      hints: [hintFixture({ id: 'shot', text: 'remove this header', attachmentIds: ['a', 'b'] })],
      attachments: [image('a'), image('b'), image('other')],
    });

    await decide();

    expect(decideField({ key: 'canReadFiles' })).toBe(true);
    expect(decideField({ key: 'operatorHints' })).toContain(
      'write into the step brief what they show',
    );
    expect(decideField({ key: 'operatorHints' })).toContain(
      '- /work/harborline/.goodboy/attachments/a/a.png',
    );
    expect(decideField({ key: 'operatorHints' })).toContain(
      '- /work/harborline/.goodboy/attachments/b/b.png',
    );
    expect(decideField({ key: 'operatorHints' })).not.toContain('other.png');
  });

  it('loads the run attachments a restart left unloaded before it looks for the images', async () => {
    seedRun({
      hints: [hintFixture({ id: 'shot', text: 'remove this header', attachmentIds: ['a'] })],
    });
    useAppStore.setState({ workflowRunAttachments: {} });
    listRunAttachmentsSpy.mockResolvedValueOnce([image('a')]);

    await decide();

    expect(decideField({ key: 'canReadFiles' })).toBe(true);
    expect(decideField({ key: 'operatorHints' })).toContain(
      '- /work/harborline/.goodboy/attachments/a/a.png',
    );
  });

  it('hands the orchestrator the active numbered decisions of the session', async () => {
    seedRun({ hints: [] });
    useAppStore.setState({
      sessionSlots: {
        [SESSION]: [{ key: 'decisions', value: '- D4 no PR, commit locally', enabled: true }],
      },
    });

    await decide();

    expect(decideField({ key: 'decisions' })).toBe('- D4 no PR, commit locally');
  });

  it('leaves a disabled decisions slot out', async () => {
    seedRun({ hints: [] });
    useAppStore.setState({
      sessionSlots: {
        [SESSION]: [{ key: 'decisions', value: '- D4 no PR, commit locally', enabled: false }],
      },
    });

    await decide();

    expect(decideField({ key: 'decisions' })).toBe('');
  });

  it('keeps the orchestrator without file tools when no hint carries an image', async () => {
    seedRun({ hints: [hintFixture({ id: 'plain', text: 'one PR' })] });

    await decide();

    expect(decideField({ key: 'canReadFiles' })).toBeUndefined();
  });

  it('hands the orchestrator the workspace projects with the starred one first', async () => {
    seedRun({
      hints: [],
      projects: [
        aProject({
          id: brandId<ProjectId>({ value: 'project-relay' }),
          workspaceId: WORKSPACE,
          name: 'notify-relay',
        }),
        aProject({
          id: brandId<ProjectId>({ value: 'project-ledger' }),
          workspaceId: WORKSPACE,
          name: 'ledger-core',
          starredAt: FIXTURE_NOW,
          description: 'Settles payments',
        }),
      ],
    });

    await decide();

    expect(decideField({ key: 'operatorHints' })).toContain(
      '- ledger-core (repo) | starred, the owner works here most | Settles payments\n- notify-relay (repo)',
    );
    expect(decideField({ key: 'operatorHints' })).toContain(
      'When a request names no project, look in starred projects first.',
    );
  });

  it('stamps the queued hints with the decision that first read them', async () => {
    seedRun({
      hints: [
        hintFixture({
          id: 'read',
          text: 'ignore the docs',
          consumedAt: FIXTURE_NOW,
          consumedAtStep: 1,
        }),
        hintFixture({ id: 'queued', text: 'run a reviewer first' }),
      ],
    });

    await decide();

    const hints = useAppStore.getState().sessions[0]?.workflowRuns[0]?.orchestratorHints;
    const queued = hints?.find((hint) => hint.id === 'queued');
    expect(queued?.consumedAt).toBeDefined();
    expect(queued?.consumedAtStep).toBeGreaterThan(0);
    expect(hints?.find((hint) => hint.id === 'read')?.consumedAtStep).toBe(1);
    expect(updateHintsSpy).toHaveBeenCalledWith(expect.anything(), RUN, hints);
  });
});
