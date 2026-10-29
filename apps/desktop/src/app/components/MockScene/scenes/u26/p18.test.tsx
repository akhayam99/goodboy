// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U26_P18_SCENES } from './p18';

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
  const Scene = U26_P18_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const drawerOf = async (): Promise<HTMLElement> => {
  const notes = await screen.findByRole('button', { name: /^Notes, \d+ lines?$/ }, WAIT);
  fireEvent.click(notes);
  const answer = await screen.findByText('Trailer grep:', undefined, WAIT);
  const drawer = answer.closest('[data-auto-child-end]');
  if (!(drawer instanceof HTMLElement)) {
    throw new Error('no child end in the drawer');
  }
  return drawer;
};

describe('the u26 p18 child drawer scenes', () => {
  it('registers a light and a dark shot', () => {
    expect(Object.keys(U26_P18_SCENES)).toEqual(['u26-p18-drawer-light', 'u26-p18-drawer-dark']);
    for (const [id, Scene] of Object.entries(U26_P18_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('draws the child answer as markdown with no literal asterisks', async () => {
    mount({ id: 'u26-p18-drawer-light' });

    const end = await drawerOf();
    expect(end.textContent).not.toContain('**');
    expect(within(end).getByText('Trailer grep:').tagName).toBe('STRONG');
    expect(end.querySelectorAll('ul:not([aria-label]) > li').length).toBe(3);
  });

  it('keeps the composer toolbar names when the labels collapse', async () => {
    mount({ id: 'u26-p18-drawer-dark' });

    await drawerOf();
    const accessButtons = screen.getAllByRole('button', { name: 'Asks you: Full access' });
    const modelButtons = screen.getAllByRole('button', { name: /^Model routing:/ });
    expect(accessButtons).toHaveLength(1);
    expect(modelButtons.length).toBeGreaterThanOrEqual(2);
    expect(modelButtons.at(-1)?.getAttribute('aria-label')).toContain('Opus');
  });

  it.each(Object.keys(U26_P18_SCENES))('%s has no accessibility violations', async (id) => {
    const { container } = mount({ id });
    await drawerOf();
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
