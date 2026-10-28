// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U26P_USAGE_CARD_SCENES } from './UsageCardScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  document.documentElement.removeAttribute('data-theme');
});

const SCENE_IDS = ['p20-usage-card-dark', 'p20-usage-card-light'] as const;

describe('the usage card scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U26P_USAGE_CARD_SCENES).sort()).toEqual([...SCENE_IDS].sort());
    Object.entries(U26P_USAGE_CARD_SCENES).forEach(([id, Scene]) =>
      expect(MOCK_SCENES[id]).toBe(Scene),
    );
  });

  it.each(SCENE_IDS)('%s shows the five cards with a dash and a reason for gaps', async (id) => {
    const Scene = U26P_USAGE_CARD_SCENES[id];
    const { container } = render(<Scene />);
    expect(screen.getAllByRole('dialog')).toHaveLength(5);
    const noUsage = screen.getByRole('dialog', { name: 'Usage detail no-usage' });
    within(noUsage).getAllByText('no usage reported yet');
    const full = screen.getByRole('dialog', { name: 'Usage detail full' });
    within(full).getByText('~$0.07');
    const premium = screen.getByRole('dialog', { name: 'Usage detail premium' });
    within(premium).getByText('Premium requests');
    expect(within(premium).queryByText('Cost')).toBeNull();
    const { violations } = await runA11yCheck(container);
    expect(violations).toEqual([]);
  });
});
