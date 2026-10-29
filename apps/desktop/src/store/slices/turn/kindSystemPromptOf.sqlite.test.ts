// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutoLevel } from '@goodboy/core';
import { AUTO_SEED_SESSION, seedAutoSession } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type SessionId } from '@goodboy/types';
import { AGENT_KIND_DEFAULTS } from '../../../features/session/agent-kind';
import { openStorySqlite, resetStoryStore, storySqlite } from '../../storyHarness';
import { writeAutoLevel } from '../../runtime/auto/level/writeAutoLevel';
import { kindSystemPromptOf } from './kindSystemPromptOf';

const TARGET = { sessionId: AUTO_SEED_SESSION };
const MISSING = brandId<SessionId>({ value: 'session-notify-relay' });

const LABEL = { step: 'Every step', plan: 'After the plan', run: 'Never' } as const;
const LEVELS: ReadonlyArray<AutoLevel> = ['step', 'plan', 'run'];

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite() });
});

describe('kindSystemPromptOf', () => {
  it('uses After the plan for an Auto session that never picked a level', async () => {
    const prompt = await kindSystemPromptOf({ kind: 'auto', sessionId: AUTO_SEED_SESSION });

    expect(prompt).toContain('Asks you: After the plan');
  });

  for (const level of LEVELS) {
    it(`carries the saved level ${LABEL[level]} and no other`, async () => {
      await writeAutoLevel({ db: storySqlite(), target: TARGET, level });

      const prompt = await kindSystemPromptOf({ kind: 'auto', sessionId: AUTO_SEED_SESSION });

      expect(prompt).toContain(`Asks you: ${LABEL[level]}`);
      for (const other of LEVELS.filter((candidate) => candidate !== level)) {
        expect(prompt).not.toContain(`Asks you: ${LABEL[other]}`);
      }
    });
  }

  it('follows a level changed between two turns', async () => {
    await writeAutoLevel({ db: storySqlite(), target: TARGET, level: 'step' });
    const first = await kindSystemPromptOf({ kind: 'auto', sessionId: AUTO_SEED_SESSION });
    await writeAutoLevel({ db: storySqlite(), target: TARGET, level: 'run' });
    const second = await kindSystemPromptOf({ kind: 'auto', sessionId: AUTO_SEED_SESSION });

    expect(first).toContain('Asks you: Every step');
    expect(second).toContain('Asks you: Never');
  });

  it('fails the prompt instead of guessing a level for a session it cannot read', async () => {
    await expect(kindSystemPromptOf({ kind: 'auto', sessionId: MISSING })).rejects.toThrow(
      'The session no longer exists.',
    );
  });

  it('leaves every other agent kind on its own prompt', async () => {
    await writeAutoLevel({ db: storySqlite(), target: TARGET, level: 'run' });

    const prompt = await kindSystemPromptOf({ kind: 'scout', sessionId: AUTO_SEED_SESSION });

    expect(prompt).toBe(AGENT_KIND_DEFAULTS.scout.systemPrompt);
  });
});
