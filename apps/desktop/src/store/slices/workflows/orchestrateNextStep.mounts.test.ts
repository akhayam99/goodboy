// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, DEFAULT_WORKFLOW_RULES, type MountId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import {
  RUN,
  SESSION,
  WORKSPACE,
  mountFixture,
  runFixture,
  seedActionState,
  sessionFixture,
  stepAgent,
  workflowFixture,
} from '../../../__tests__/helpers/actionFixtures';

const transport = vi.hoisted(() => ({
  requests: new Array<Record<string, unknown>>(),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
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
  const reply = JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: '<<orchestrator>>{"action":"done","reason":"all set"}<</orchestrator>>',
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  return {
    ...original,
    OrchestratorClient: vi.fn(function (
      deps: ConstructorParameters<typeof original.OrchestratorClient>[0],
    ) {
      return new original.OrchestratorClient({
        ...deps,
        invokeFn: async (_command: string, args?: Record<string, unknown>) => {
          transport.requests.push(args ?? {});
          return JSON.parse(JSON.stringify({ stdout: reply, stderr: '', exitCode: 0 }));
        },
      });
    }),
  };
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.clearAllMocks();
  transport.requests.length = 0;
  await resetStoryStore();
});

const PAYMENTS = mountFixture({
  mountId: brandId<MountId>({ value: 'mount-payments-api' }),
  mountName: 'payments-api',
  branch: 'hl/refund-flow',
});

const NOTIFY = mountFixture({
  mountId: brandId<MountId>({ value: 'mount-notify-relay' }),
  mountName: 'notify-relay',
  branch: 'hl/refund-mail',
  worktreePath: '/work/harborline/notify-relay-refund',
});

type SeedParams = {
  readonly mounts: ReadonlyArray<typeof PAYMENTS>;
  readonly isPreset?: boolean;
};

const seedRun = ({ mounts, isPreset = false }: SeedParams): void => {
  const session = sessionFixture({
    workflowRuns: [
      runFixture({
        executionMode: 'dynamic',
        autoRun: true,
        ...(isPreset && {
          rulesSnapshot: {
            ...DEFAULT_WORKFLOW_RULES,
            preset: {
              workflowId: 'workflow-refund',
              name: 'Fix a refund',
              steps: [
                {
                  name: 'Find',
                  role: 'scout',
                  promptPrefix: 'Find the refund path.',
                  isPinned: false,
                  routingLock: null,
                },
              ],
            },
          },
        }),
      }),
    ],
  });
  seedActionState({
    useAppStore,
    seed: {
      session,
      mounts,
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
  useAppStore.setState({ phaseTemplates: { [WORKSPACE]: [workflowFixture()] } });
};

const sentText = (field: 'userMessage' | 'systemPrompt'): string => {
  const value = transport.requests[0]?.['args'];
  if (typeof value !== 'object' || value === null) {
    return '';
  }
  const text: unknown = Reflect.get(value, field);
  return typeof text === 'string' ? text : '';
};

const decide = () => useAppStore.getState().orchestrateNextStep(SESSION, RUN);

describe('orchestrateNextStep mounts', () => {
  it('names both mounts with their ids in the request when the project has two', async () => {
    seedRun({ mounts: [PAYMENTS, NOTIFY] });

    await decide();

    expect(transport.requests).toHaveLength(1);
    const prompt = sentText('userMessage');
    expect(prompt).toContain('- mountId mount-payments-api: payments-api, branch hl/refund-flow');
    expect(prompt).toContain('- mountId mount-notify-relay: notify-relay, branch hl/refund-mail');
    expect(sentText('systemPrompt')).toContain('"mountId"');
  });

  it('keeps the request free of mount lines with one mount', async () => {
    seedRun({ mounts: [PAYMENTS] });

    await decide();

    expect(transport.requests).toHaveLength(1);
    expect(sentText('userMessage')).not.toContain('mountId');
    expect(sentText('systemPrompt')).not.toContain('mountId');
  });

  it('names both mounts in a preset run too', async () => {
    seedRun({ mounts: [PAYMENTS, NOTIFY], isPreset: true });

    await decide();

    expect(sentText('userMessage')).toContain('Preset: Fix a refund');
    expect(sentText('userMessage')).toContain('mountId mount-payments-api');
    expect(sentText('userMessage')).toContain('mountId mount-notify-relay');
  });
});
