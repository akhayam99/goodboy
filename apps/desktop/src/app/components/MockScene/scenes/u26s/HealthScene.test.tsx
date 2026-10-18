// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U26S_HEALTH_SCENES } from './HealthScene';

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

const railOf = async (): Promise<HTMLElement> =>
  screen.findByRole('navigation', { name: 'Settings scopes' }, WAIT);

describe('the health scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U26S_HEALTH_SCENES).sort()).toEqual([
      'u26s-health-codexaccount',
      'u26s-health-codexmenu',
      'u26s-health-linear',
    ]);
    expect(MOCK_SCENES['u26s-health-linear']).toBe(U26S_HEALTH_SCENES['u26s-health-linear']);
  });

  it('u26s-health-linear shows the missing key in the notice, the chip and the rail dot', async () => {
    const Scene = U26S_HEALTH_SCENES['u26s-health-linear'];
    render(<Scene />);
    const rail = await railOf();

    await screen.findByText('The Linear key is missing from this Mac', undefined, WAIT);
    expect(screen.getByText('Key missing')).toBeDefined();
    await waitFor(
      () =>
        expect(
          within(rail)
            .getByRole('button', { name: /Linear/ })
            .querySelector('[role="img"]'),
        ).not.toBeNull(),
      WAIT,
    );
    expect(
      within(rail)
        .getByRole('button', { name: /Linear/ })
        .querySelector('[role="img"]')
        ?.getAttribute('aria-label'),
    ).toBe('Key missing on this Mac');
    expect(
      within(rail).getByRole('button', { name: /Jira/ }).querySelector('[role="img"]'),
    ).toBeNull();
  });

  it('u26s-health-codexmenu opens the provider menu with Disconnect last', async () => {
    const Scene = U26S_HEALTH_SCENES['u26s-health-codexmenu'];
    render(<Scene />);
    await railOf();

    const items = await screen.findAllByRole('menuitem', undefined, WAIT);
    expect(items.map((item) => item.textContent)).toEqual([
      'Check again',
      'Sign in again',
      'History',
      'Copy CLI path',
      'Disconnect',
    ]);
    const account = within(screen.getByRole('region', { name: 'Account' }));
    expect(account.getByText('Signed in as harborline-platform')).toBeDefined();
    expect(account.getByText('Working')).toBeDefined();
    expect(account.queryByRole('button', { name: 'Disconnect' })).toBeNull();
  });
});
