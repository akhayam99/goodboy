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
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U39_DESTINATIONS_SCENES } from './destinations';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mount = () => {
  const Scene = U39_DESTINATIONS_SCENES['u39-destinations'];
  if (Scene === undefined) {
    throw new Error('no scene u39-destinations');
  }
  return render(<Scene />).container;
};

describe('the destination sheet scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U39_DESTINATIONS_SCENES)).toEqual(['u39-destinations']);
    expect(MOCK_SCENES['u39-destinations']).toBe(U39_DESTINATIONS_SCENES['u39-destinations']);
  });

  it('shows the same word for a destination in every channel that names it', () => {
    const container = mount();

    const rows = Array.from(container.querySelectorAll<HTMLElement>('tr[data-destination]'));
    expect(rows).toHaveLength(9);
    rows.forEach((row) => {
      const [column = '', goMenu = '', palette = ''] = within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? '');
      const label = row.querySelector('th')?.textContent ?? '';
      expect(goMenu).toBe(label);
      expect(palette.startsWith(label)).toBe(true);
      expect([label, 'bell']).toContain(column);
    });
  });

  it('has no accessibility violation', async () => {
    const { violations } = await runA11yCheck(mount());

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
