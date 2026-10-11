// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_SETTINGS_PROJECTS_SCENES } from './settings-projects';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U24_SETTINGS_PROJECTS_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U24_SETTINGS_PROJECTS_SCENES[id];
  render(<Scene />);
};

describe('the settings projects scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_SETTINGS_PROJECTS_SCENES).sort()).toEqual([
      'picker-starred',
      'settings-projects-failed',
      'settings-projects-nostar',
      'settings-projects-open',
      'settings-projects-rows',
    ]);
    expect(MOCK_SCENES['settings-projects-rows']).toBe(
      U24_SETTINGS_PROJECTS_SCENES['settings-projects-rows'],
    );
  });

  it('rows draws two headed groups, with no scripts toggle and a star only on starred rows', async () => {
    mount({ id: 'settings-projects-rows' });

    const starred = await screen.findByRole('region', { name: 'Starred' }, WAIT);
    const others = screen.getByRole('region', { name: 'Other projects' });
    expect(within(starred).getByText('4')).toBeDefined();
    expect(within(others).getByText('6')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Scripts of/ })).toBeNull();
    expect(
      within(starred)
        .getAllByRole('button', { name: /^Starred: / })
        .every((star) => star.getAttribute('data-quiet-at-rest') === null),
    ).toBe(true);
    expect(
      within(others)
        .getAllByRole('button', { name: /^Starred: / })
        .every((star) => star.getAttribute('data-quiet-at-rest') === 'true'),
    ).toBe(true);
    screen.getByRole('group', { name: 'Terminal folder' });
  });

  it('open shows the scripts in the editor card with the pinned count and no toggle', async () => {
    mount({ id: 'settings-projects-open' });

    const scripts = await screen.findByRole('group', { name: 'Scripts of ledger-core' }, WAIT);
    within(scripts).getByText('Scripts · 2 pinned');
    expect(within(scripts).getByRole('button', { name: 'Unpin dev' })).toBeDefined();
    expect(within(scripts).getByRole('button', { name: 'Pin build' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Scripts of/ })).toBeNull();
  });

  it('failed shows the scripts error as a notice with Retry', async () => {
    mount({ id: 'settings-projects-failed' });

    const notice = await screen.findByRole('alert', undefined, WAIT);
    within(notice).getByText("Couldn't read the scripts");
    expect(within(notice).getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('nostar draws one Projects heading and the star hint', async () => {
    mount({ id: 'settings-projects-nostar' });

    await screen.findByText('Star the ones you use most.', undefined, WAIT);
    expect(screen.getByRole('heading', { name: 'Projects', level: 2 })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Starred' })).toBeNull();
  });

  it('picker-starred heads the starred projects above the others', async () => {
    mount({ id: 'picker-starred' });

    await screen.findByText('Starred', undefined, WAIT);
    screen.getByText('Other projects');
    const names = screen
      .getAllByRole('button', { name: /^Add / })
      .map((button) => button.textContent);
    expect(names.slice(0, 4)).toEqual([
      'cascadia-web',
      'ledger-core',
      'notify-relay',
      'payments-api',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Add acme-infra' }));
  });
});
