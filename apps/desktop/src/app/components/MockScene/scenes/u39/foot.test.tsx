// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U39_FOOT_SCENES } from './foot';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type MountParams = {
  readonly id: string;
};

type PanelParams = {
  readonly container: HTMLElement;
  readonly name: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U39_FOOT_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  ).container;
};

const panel = ({ container, name }: PanelParams) => {
  const found = container.querySelector<HTMLElement>(`[data-foot-panel="${name}"]`);
  if (found === null) {
    throw new Error(`no panel ${name}`);
  }
  return found;
};

describe('the foot scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(Object.keys(U39_FOOT_SCENES)).toEqual(['u39-foot', 'u39-foot-update']);
    Object.entries(U39_FOOT_SCENES).forEach(([id, Scene]) => expect(MOCK_SCENES[id]).toBe(Scene));
  });

  it('shows Settings, the Goodboy line and the bug icon in the open column, with Help lit only when open', async () => {
    const container = mount({ id: 'u39-foot' });

    await waitFor(() => expect(container.querySelectorAll('[data-foot-panel]')).toHaveLength(4));
    const open = within(panel({ container, name: 'Open column' }));
    open.getByRole('button', { name: 'Settings' });
    open.getByRole('button', { name: 'Report a bug' });
    expect(
      open.getByRole('button', { name: 'Goodboy, help' }).getAttribute('aria-current'),
    ).toBeNull();
    const help = within(panel({ container, name: 'Help open' }));
    expect(help.getByRole('button', { name: 'Goodboy, help' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('keeps the same three controls on the folded rail', async () => {
    const container = mount({ id: 'u39-foot' });

    await waitFor(() => expect(container.querySelectorAll('[data-foot-panel]')).toHaveLength(4));
    const rail = within(panel({ container, name: 'Folded rail' }));
    rail.getByRole('button', { name: 'Settings' });
    rail.getByRole('button', { name: 'Report a bug' });
    rail.getByRole('button', { name: 'Goodboy, help' });
  });

  it('puts the update pill in the open column and the dot on the folded mark', async () => {
    const container = mount({ id: 'u39-foot-update' });

    await waitFor(() => expect(container.querySelectorAll('[data-foot-panel]')).toHaveLength(4));
    const open = within(panel({ container, name: 'Open column' }));
    open.getByRole('button', { name: 'Goodboy 0.33.1 is available' });
    const rail = within(panel({ container, name: 'Folded rail' }));
    expect(rail.queryByRole('button', { name: 'Goodboy 0.33.1 is available' })).toBeNull();
    rail.getByRole('button', { name: /^Goodboy, help, Goodboy 0.33.1 is available/ });
  });
});
