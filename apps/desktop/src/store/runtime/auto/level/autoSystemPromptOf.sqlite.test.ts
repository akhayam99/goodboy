// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutoLevel } from '@goodboy/core';
import {
  AUTO_SEED_ROOT,
  AUTO_SEED_SESSION,
  seedAutoSession,
} from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { openStorySqlite, resetStoryStore, storySqlite } from '../../../storyHarness';
import { autoSystemPromptOf } from './autoSystemPromptOf';
import { writeRunGuidance } from '../../runGuidance/writeRunGuidance';
import { writeAutoLevel } from './writeAutoLevel';

const TARGET = { sessionId: AUTO_SEED_SESSION };
const MISSING = brandId<SessionId>({ value: 'session-notify-relay' });

const LABEL = { step: 'Every step', plan: 'After the plan', run: 'Never' } as const;
const LEVELS: ReadonlyArray<AutoLevel> = ['step', 'plan', 'run'];

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite() });
});

describe('autoSystemPromptOf', () => {
  it('uses After the plan for an Auto session that never picked a level', async () => {
    const prompt = await autoSystemPromptOf({ sessionId: AUTO_SEED_SESSION });

    expect(prompt).toContain('Asks you: After the plan');
  });

  for (const level of LEVELS) {
    it(`carries the saved level ${LABEL[level]} and no other`, async () => {
      await writeAutoLevel({ db: storySqlite(), target: TARGET, level });

      const prompt = await autoSystemPromptOf({ sessionId: AUTO_SEED_SESSION });

      expect(prompt).toContain(`Asks you: ${LABEL[level]}`);
      for (const other of LEVELS.filter((candidate) => candidate !== level)) {
        expect(prompt).not.toContain(`Asks you: ${LABEL[other]}`);
      }
    });
  }

  it('names the language of the anchor it is handed', async () => {
    const prompt = await autoSystemPromptOf({
      sessionId: AUTO_SEED_SESSION,
      languageAnchor:
        'Sistema il layout delle pagine membro in harbor-portal e controlla `pnpm typecheck`',
    });

    expect(prompt).toContain('Write every reply, question, suggestion and summary in Italian.');
  });

  it('follows a level changed between two turns', async () => {
    await writeAutoLevel({ db: storySqlite(), target: TARGET, level: 'step' });
    const first = await autoSystemPromptOf({ sessionId: AUTO_SEED_SESSION });
    await writeAutoLevel({ db: storySqlite(), target: TARGET, level: 'run' });
    const second = await autoSystemPromptOf({ sessionId: AUTO_SEED_SESSION });

    expect(first).toContain('Asks you: Every step');
    expect(second).toContain('Asks you: Never');
  });

  it('fails the prompt instead of guessing a level for a session it cannot read', async () => {
    await expect(autoSystemPromptOf({ sessionId: MISSING })).rejects.toThrow(
      'The session no longer exists.',
    );
  });
});

describe('autoSystemPromptOf with the guidance of the run', () => {
  const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
  const GUIDANCE = 'Keep every change inside ledger-core.';

  it('adds the guidance of the Auto root once', async () => {
    await writeRunGuidance({
      db: storySqlite(),
      workspaceId: WORKSPACE,
      agentId: AUTO_SEED_ROOT,
      text: GUIDANCE,
    });

    const prompt = await autoSystemPromptOf({
      sessionId: AUTO_SEED_SESSION,
      agentId: AUTO_SEED_ROOT,
    });

    expect(prompt).toContain(`GUIDANCE FOR THIS RUN\n`);
    expect(prompt).toContain(`\n${GUIDANCE}`);
    expect(prompt.split(GUIDANCE)).toHaveLength(2);
  });

  it('keeps the guidance on every turn because the prompt is rebuilt each time', async () => {
    await writeRunGuidance({
      db: storySqlite(),
      workspaceId: WORKSPACE,
      agentId: AUTO_SEED_ROOT,
      text: GUIDANCE,
    });
    await writeAutoLevel({ db: storySqlite(), target: TARGET, level: 'step' });

    const first = await autoSystemPromptOf({
      sessionId: AUTO_SEED_SESSION,
      agentId: AUTO_SEED_ROOT,
    });
    const second = await autoSystemPromptOf({
      sessionId: AUTO_SEED_SESSION,
      agentId: AUTO_SEED_ROOT,
    });

    expect(second).toBe(first);
    expect(first).toContain(GUIDANCE);
  });

  it('is byte for byte the prompt of today when the run has no guidance', async () => {
    const without = await autoSystemPromptOf({ sessionId: AUTO_SEED_SESSION });
    const withRoot = await autoSystemPromptOf({
      sessionId: AUTO_SEED_SESSION,
      agentId: AUTO_SEED_ROOT,
    });

    expect(withRoot).toBe(without);
    expect(withRoot).not.toContain('GUIDANCE FOR THIS RUN');
  });

  it('does not hand the guidance of another agent to this one', async () => {
    await writeRunGuidance({
      db: storySqlite(),
      workspaceId: WORKSPACE,
      agentId: brandId<AgentId>({ value: 'agent-notify-relay' }),
      text: GUIDANCE,
    });

    const prompt = await autoSystemPromptOf({
      sessionId: AUTO_SEED_SESSION,
      agentId: AUTO_SEED_ROOT,
    });

    expect(prompt).not.toContain(GUIDANCE);
  });
});
