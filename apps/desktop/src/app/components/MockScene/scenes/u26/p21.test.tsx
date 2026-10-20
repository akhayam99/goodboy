// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U26_P21_SCENES } from './p21';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U26_P21_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u26 p21 drawer composer scenes', () => {
  it('registers a light and a dark shot', () => {
    expect(Object.keys(U26_P21_SCENES)).toEqual([
      'u26-p21-drawer-composer-light',
      'u26-p21-drawer-composer-dark',
    ]);
    for (const [id, Scene] of Object.entries(U26_P21_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('types in the drawer composer and leaves the Auto composer empty', async () => {
    mount({ id: 'u26-p21-drawer-composer-dark' });

    const drawer = await screen.findByPlaceholderText('Message Implementer', undefined, WAIT);
    const main = await screen.findByPlaceholderText('Message Auto', undefined, WAIT);
    expect(drawer).toHaveProperty('value', expect.stringContaining('applyCredit'));
    expect(main).toHaveProperty('value', '');
  });

  it.each(Object.keys(U26_P21_SCENES))('%s has no accessibility violations', async (id) => {
    const { container } = mount({ id });
    await screen.findByPlaceholderText('Message Implementer', undefined, WAIT);
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
