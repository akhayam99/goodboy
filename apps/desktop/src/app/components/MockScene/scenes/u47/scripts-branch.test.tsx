// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U47_SCRIPTS_BRANCH_SCENES } from './scripts-branch';

beforeAll(async () => {
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

describe('the u47 scripts branch scenes', () => {
  it('registers every scene', () => {
    for (const [name, Scene] of Object.entries(U47_SCRIPTS_BRANCH_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
  });

  it('opens the palette on the branch step of a script with two branches', async () => {
    const Scene = U47_SCRIPTS_BRANCH_SCENES['u47-scripts-branch-step'];
    render(<Scene />);

    expect(await screen.findByText('Run Replay settlement batch on which branch?')).toBeDefined();
    expect(
      screen.getAllByRole('option').map((option) => option.getAttribute('aria-label')),
    ).toEqual(['hl/payout-export', 'hl/payout-webhook']);
  });
});
