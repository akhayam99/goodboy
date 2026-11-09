// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { sceneInvoke } from '../../../../../test/sceneInvoke';
import { STORY_COMMENT, STORY_PLAN } from '../../scenes/story/storyContent';
import { STORY_PLAN_ID, STORY_SESSION_ID, seedStoryWorld } from '../../scenes/story/storyWorld';
import { installArtifactComments } from './installArtifactComments';
import { installPlanCommentPrefill } from './installPlanCommentPrefill';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  document.body.innerHTML = '';
  seedStoryWorld({ stage: 'asking' });
  installArtifactComments({ store });
});

afterEach(() => {
  document.body.innerHTML = '';
});

const COMPOSER = (id: string): string => `
  <div data-testid="plan-comment-composer" id="${id}"><textarea></textarea></div>
`;

const fieldOf = (id: string): HTMLTextAreaElement | null =>
  document.querySelector<HTMLTextAreaElement>(`#${id} textarea`);

const mount = async (id: string): Promise<void> => {
  document.body.insertAdjacentHTML('beforeend', COMPOSER(id));
  await Promise.resolve();
};

const unmount = async (id: string): Promise<void> => {
  document.querySelector(`#${id}`)?.remove();
  await Promise.resolve();
};

const anchor = { kind: 'block', order: 4, text: STORY_PLAN.replayParagraph } as const;

const add = async (): Promise<string | null> =>
  store.getState().addArtifactComment({
    sessionId: STORY_SESSION_ID,
    artifactId: STORY_PLAN_ID,
    revision: 1,
    anchor,
    body: STORY_COMMENT,
  });

const draftsOf = () => store.getState().artifactComments[STORY_SESSION_ID] ?? [];

describe('the prepared plan comment', () => {
  it('fills the first composer the visitor opens', async () => {
    installPlanCommentPrefill({ store });
    await mount('first');
    expect(fieldOf('first')?.value).toBe(STORY_COMMENT);
  });

  it('leaves a composer opened after the comment was added empty, so it cannot be kept as a second draft', async () => {
    installPlanCommentPrefill({ store });
    await mount('first');
    await add();
    await unmount('first');
    await mount('second');
    expect(fieldOf('second')?.value).toBe('');
  });

  it('fills the composer again when the first one was closed before a comment was added', async () => {
    installPlanCommentPrefill({ store });
    await mount('first');
    await unmount('first');
    await mount('second');
    expect(fieldOf('second')?.value).toBe(STORY_COMMENT);
  });
});

describe('adding the same draft twice', () => {
  it('keeps one draft and returns the id of the first', async () => {
    const first = await add();
    const second = await add();
    expect(draftsOf()).toHaveLength(1);
    expect(second).toBe(first);
  });

  it('keeps a second draft on another part of the plan', async () => {
    await add();
    await store.getState().addArtifactComment({
      sessionId: STORY_SESSION_ID,
      artifactId: STORY_PLAN_ID,
      revision: 1,
      anchor: { kind: 'part', index: 1, title: 'Part' },
      body: STORY_COMMENT,
    });
    expect(draftsOf()).toHaveLength(2);
  });
});
