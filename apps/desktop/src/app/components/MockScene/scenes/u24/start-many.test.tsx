// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_START_MANY_SCENES } from './start-many';

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

type SceneId = keyof typeof U24_START_MANY_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U24_START_MANY_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the start many scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_START_MANY_SCENES).sort()).toEqual([
      'start-cap',
      'start-crossproject',
      'start-multiselect',
      'start-picked3',
    ]);
    expect(MOCK_SCENES['start-picked3']).toBe(U24_START_MANY_SCENES['start-picked3']);
  });

  it('start-multiselect checks two rows and offers to pick both', async () => {
    mount({ id: 'start-multiselect' });

    expect(await screen.findByRole('button', { name: 'Pick 2 issues' }, WAIT)).toBeDefined();
    await screen.findByRole('checkbox', { name: /HBL-389/ }, WAIT);
    const rows = screen.getAllByRole('checkbox');
    expect(rows.filter((row) => row.getAttribute('aria-checked') === 'true')).toHaveLength(2);
  });

  it('start-cap refuses the sixth issue with one line', async () => {
    mount({ id: 'start-cap' });

    expect(await screen.findByRole('button', { name: 'Pick 5 issues' }, WAIT)).toBeDefined();
    fireEvent.click(screen.getByRole('checkbox', { name: /HBL-389/ }));
    expect((await screen.findByRole('status', {}, WAIT)).textContent).toBe(
      'Up to 5 issues start one session',
    );
  });

  it('start-picked3 stacks three rows with the branch chip on the first', async () => {
    mount({ id: 'start-picked3' });

    const list = await screen.findByRole('list', { name: 'Picked issues' }, WAIT);
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.textContent).toContain('Names the branch');
    expect(screen.getByRole('region', { name: 'Brief from HBL-412 and 2 more' })).toBeDefined();
    expect(screen.getByText('Will close HBL-412, HBL-398, HBL-405 when merged')).toBeDefined();
  });

  it('start-crossproject says the second issue belongs to another project', async () => {
    mount({ id: 'start-crossproject' });

    expect(
      await screen.findByText(
        '#211 belongs to notify-relay. It links to the session and can be put on a branch there later.',
        {},
        WAIT,
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start from #204 and 1 more' })).toBeDefined();
  });
});
