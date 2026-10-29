// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalAttachment, OrchestratorHint } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import {
  FIXTURE_NOW,
  RUN,
  STEP_BUILD,
  STEP_PLAN,
  WORKSPACE,
  agentFixture,
  mountFixture,
  runFixture,
  seedActionState,
  sessionFixture,
  stepAgent,
  workflowFixture,
} from '../../../__tests__/helpers/actionFixtures';
import { buildGoalAttachmentsBlock } from './turnHelpers';
import { hintImagesForStep } from './hintImagesForStep';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const attachment = (id: string): GoalAttachment => ({
  id,
  ownerType: 'workflow_run',
  ownerId: RUN,
  relPath: `.goodboy/attachments/${id}/${id}.png`,
  kind: 'image',
  fileName: `${id}.png`,
  mimeType: 'image/png',
  createdAt: FIXTURE_NOW,
});

const ATTACHMENTS = [attachment('a'), attachment('b'), attachment('other')];

const SHOT: OrchestratorHint = {
  id: 'shot',
  text: 'remove this header\nit sits above the ledger table',
  createdAt: FIXTURE_NOW,
  consumedAt: FIXTURE_NOW,
  consumedAtStep: 2,
  attachmentIds: ['a', 'b'],
};

const blockFor = ({ stepId }: { readonly stepId: typeof STEP_PLAN }) => {
  const mount = mountFixture();
  const session = sessionFixture({
    workflowRuns: [runFixture({ executionMode: 'dynamic', orchestratorHints: [SHOT] })],
  });
  const agent = stepAgent({ id: 'agent-step', stepId, status: 'running' });
  seedActionState({
    useAppStore,
    seed: { session, agents: [agent], mounts: [mount] },
  });
  useAppStore.setState({ phaseTemplates: { [WORKSPACE]: [workflowFixture()] } });
  return {
    mount,
    block: hintImagesForStep({
      get: useAppStore.getState,
      session,
      agent,
      attachments: ATTACHMENTS,
    }),
  };
};

describe('hintImagesForStep', () => {
  it('gives the step launched by the decision that read the hint exactly its images', () => {
    const { block, mount } = blockFor({ stepId: STEP_BUILD });
    expect(block?.text).toContain("Images from the user's hint: remove this header");
    expect(block?.text).not.toContain('ledger table');
    expect(block?.text.split('\n').filter((line) => line.startsWith('- '))).toEqual([
      `- ${mount.worktreePath}/.goodboy/attachments/a/a.png`,
      `- ${mount.worktreePath}/.goodboy/attachments/b/b.png`,
    ]);
  });

  it('gives another step of the run nothing', () => {
    const { block } = blockFor({ stepId: STEP_PLAN });
    expect(block?.text).toBe('');
  });

  it('keeps the hint images out of the general run files and still lists them for an implementer', () => {
    const { block } = blockFor({ stepId: STEP_BUILD });
    const general = buildGoalAttachmentsBlock(
      'implementer',
      ATTACHMENTS.filter((att) => block?.attachmentIds.has(att.id) !== true),
      { isKickoff: true },
    );
    expect(general).toBe('');
    expect(block?.text).toContain('/a/a.png');
  });

  it('has no block for an agent outside a run', () => {
    seedActionState({ useAppStore, seed: { mounts: [mountFixture()] } });
    expect(
      hintImagesForStep({
        get: useAppStore.getState,
        session: sessionFixture(),
        agent: agentFixture(),
        attachments: ATTACHMENTS,
      }),
    ).toBeNull();
  });
});
