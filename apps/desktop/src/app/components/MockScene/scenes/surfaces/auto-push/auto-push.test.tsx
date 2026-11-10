// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../store/storyHarness';
import { MOCK_SCENES } from '../../..';
import { AUTO_PUSH_SCENES } from './auto-push';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type SceneId = keyof typeof AUTO_PUSH_SCENES;

type ShowParams = {
  readonly id: SceneId;
};

const show = async ({ id }: ShowParams): Promise<HTMLElement> => {
  const Scene = AUTO_PUSH_SCENES[id];
  render(<Scene />);
  return screen.findByRole('group', { name: 'Force push' });
};

describe('the Auto force push scenes', () => {
  it('registers both scenes', () => {
    expect(Object.keys(AUTO_PUSH_SCENES).filter((id) => MOCK_SCENES[id] === undefined)).toEqual([]);
  });

  it('asks once for the whole batch', async () => {
    const row = await show({ id: 'auto-push-ask' });

    within(row).getByRole('group', { name: 'Confirm the force push' });
    within(row).getByRole('button', { name: 'Force push' });
  });

  it('shows every branch result in place with its own action', async () => {
    const row = await show({ id: 'auto-push-results' });

    within(row).getByRole('button', { name: 'Put back' });
    within(row).getByRole('button', { name: 'Retry push' });
    within(row).getByText('Pushing harborline/fix-payments at abc1234');
    within(row).getByText('Not pushed: you declined the push of acme/tidy-history');
  });
});
