// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { workspaceAccent } from '../../../../../features/workspace/color';
import { seedSettingsBase } from '../audit/settingsSeed';
import { BRAND_WORKSPACE_ID } from '../brand/canon';
import { seedStoryReview } from '../story/storyReviewSeed';
import { seedStoryWorld } from '../story/storyWorld';
import { seedDemoStorage } from './demoStorageSeed';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const harborlineAccent = (): string | null => {
  const workspace = useAppStore
    .getState()
    .workspaces.find((candidate) => candidate.name === 'Harborline');
  return workspace === undefined ? null : workspaceAccent(workspace.id);
};

const SEEDS: ReadonlyArray<readonly [string, () => void]> = [
  ['story-bring', () => seedStoryWorld({ stage: 'bring' })],
  ['story-plan', () => seedStoryWorld({ stage: 'asking' })],
  ['story-review', () => seedStoryReview()],
  [
    'demo-storage',
    () => {
      seedSettingsBase();
      seedDemoStorage();
    },
  ],
];

describe('Harborline accent across the demo scenes', () => {
  it.each(SEEDS)('%s paints Harborline with the brand accent', (_scene, seed) => {
    seed();

    expect(harborlineAccent()).toBe(workspaceAccent(BRAND_WORKSPACE_ID));
  });
});
