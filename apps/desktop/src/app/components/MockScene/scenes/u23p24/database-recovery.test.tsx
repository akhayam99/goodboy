// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U23P24_DATABASE_RECOVERY_SCENES } from './database-recovery';

const SCENE = 'u23p24-database-recovery';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  applyDocumentTheme({ theme: 'dark' });
});

const mount = (): Element => {
  const Scene = U23P24_DATABASE_RECOVERY_SCENES[SCENE];
  if (Scene === undefined) {
    throw new Error('no scene');
  }
  return render(<Scene />).container;
};

describe('the database recovery scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U23P24_DATABASE_RECOVERY_SCENES[SCENE]);
  });

  it('shows Retry and Move aside and restart, then the confirm', () => {
    mount();

    screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(screen.getByRole('button', { name: 'Move aside and restart' }));
    screen.getByRole('group', { name: 'Move the database aside?' });
  });

  it('has no accessibility violation', async () => {
    const container = mount();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
