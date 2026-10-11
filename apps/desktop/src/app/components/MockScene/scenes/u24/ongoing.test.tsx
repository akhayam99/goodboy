// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { MOCK_SCENES } from '../..';
import { U24_ONGOING_SCENES } from './ongoing';

type MountParams = { readonly id: keyof typeof U24_ONGOING_SCENES };

const mount = ({ id }: MountParams) => {
  const Scene = U24_ONGOING_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the ongoing scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(Object.keys(U24_ONGOING_SCENES).sort()).toEqual(['board-no-ongoing', 'linkwork-star']);
    expect(MOCK_SCENES['board-no-ongoing']).toBe(U24_ONGOING_SCENES['board-no-ongoing']);
    expect(MOCK_SCENES['linkwork-star']).toBe(U24_ONGOING_SCENES['linkwork-star']);
    expect(MOCK_SCENES['board-ongoing']).toBeUndefined();
  });

  it('draws the Board with its header alone and no Ongoing row', async () => {
    mount({ id: 'board-no-ongoing' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Board' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'New session' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Ongoing')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Ongoing' })).toBeNull();
    expect(screen.queryByText('HL-204')).toBeNull();
  });

  it('offers Star it on a tracker issue and no workspace tab', () => {
    mount({ id: 'linkwork-star' });

    expect(screen.getAllByRole('option').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('tab', { name: /Whole workspace/ })).toBeNull();
    const preview = within(screen.getByLabelText('Link preview'));
    expect(preview.getByRole('button', { name: 'Star it' })).toBeDefined();

    fireEvent.mouseMove(screen.getByRole('option', { name: /Ledger cleanup/ }));
    expect(
      within(screen.getByLabelText('Link preview'))
        .getByRole('button', { name: 'Starred' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });
});
