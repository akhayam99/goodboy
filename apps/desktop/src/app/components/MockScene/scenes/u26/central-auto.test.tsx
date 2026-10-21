// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U26_CENTRAL_AUTO_SCENES } from './central-auto';

const WAIT = { timeout: 15_000 };
const REVIEW = 'Review the retry fix in payments-api';
const FIX = 'Fix the two doc mismatches in ledger-core';

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
  const Scene = U26_CENTRAL_AUTO_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(<Scene />);
};

describe('the u26 central Auto group scenes', () => {
  it('registers a light and a dark shot for each case', () => {
    expect(Object.keys(U26_CENTRAL_AUTO_SCENES).sort()).toEqual(
      ['blocked', 'done', 'failed', 'stuck', 'working'].flatMap((name) => [
        `u26-central-auto-${name}-dark`,
        `u26-central-auto-${name}-light`,
      ]),
    );
    for (const [id, Scene] of Object.entries(U26_CENTRAL_AUTO_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('shows a done Reviewer and a working Implementer', async () => {
    mount({ id: 'u26-central-auto-working-light' });

    expect(await screen.findByRole('button', { name: `${REVIEW}, done` }, WAIT)).toBeDefined();
    expect(screen.getByRole('button', { name: `${FIX}, working` })).toBeDefined();
    expect(screen.getByText('Found 2 doc mismatches')).toBeDefined();
    expect(screen.getByText('Waiting for Implementer')).toBeDefined();
  });

  it('shows the Implementer that never started', async () => {
    mount({ id: 'u26-central-auto-stuck-dark' });

    expect(
      await screen.findByRole('button', { name: `${FIX}, never started` }, WAIT),
    ).toBeDefined();
    expect(screen.getByText(/no first message reached it/)).toBeDefined();
  });

  it('shows a blocked Implementer in its own words and a done Reviewer with its result', async () => {
    mount({ id: 'u26-central-auto-blocked-light' });

    expect(await screen.findByRole('button', { name: `${FIX}, blocked` }, WAIT)).toBeDefined();
    screen.getByText('The ledger-core docs folder is not in this checkout.');
    screen.getByText('Two doc mismatches in ledger-core, no blocking issue.');
    expect(screen.queryByText(/declared_blocked/)).toBeNull();
    expect(screen.queryByText(/I will now read/)).toBeNull();
    expect(screen.queryByText(/^Auto asked:/)).toBeNull();
    expect(document.querySelector('[data-auto-word]')?.textContent).toBe('Stuck');
  });

  it('shows a timed out Implementer with its reason', async () => {
    mount({ id: 'u26-central-auto-failed-light' });

    expect(await screen.findByRole('button', { name: `${FIX}, timed out` }, WAIT)).toBeDefined();
    expect(screen.getByText('It ran out of time.')).toBeDefined();
    expect(screen.queryByText('deadline_passed')).toBeNull();
  });

  it('folds a finished tree to one line', async () => {
    mount({ id: 'u26-central-auto-done-dark' });

    expect(
      await screen.findByText(/2 agents finished: Reviewer and Implementer/, {}, WAIT),
    ).toBeDefined();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it.each(Object.keys(U26_CENTRAL_AUTO_SCENES))(
    '%s has no accessibility violations',
    async (id) => {
      const { container } = mount({ id });
      await screen.findByRole('region', {}, WAIT);
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
