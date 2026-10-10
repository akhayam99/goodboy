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
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { MOCK_SCENES } from '../..';
import { U24_WRITE_FROM_WORK_SCENES } from './write-from-work';

type Params = { readonly id: keyof typeof U24_WRITE_FROM_WORK_SCENES };
const mount = ({ id }: Params) => {
  const Scene = U24_WRITE_FROM_WORK_SCENES[id];
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

describe('write from work scenes', () => {
  it('registers all four capture states', () => {
    for (const id of Object.keys(U24_WRITE_FROM_WORK_SCENES)) {
      expect(MOCK_SCENES[id]).toBeDefined();
    }
  });
  it('shows the first hint with two linked issues', async () => {
    mount({ id: 'goalhint' });
    expect(
      await screen.findByText('Write the title and goal from HL-204 and HL-211?'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Write' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'More session actions' }));
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole('menuitem', { name: 'Write title and goal from linked work' }),
    ).toBeDefined();
  });
  it('shows an editable proposal and the model cost', async () => {
    mount({ id: 'goalproposal' });
    expect(await screen.findByRole('textbox', { name: 'Proposed title' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Proposed goal' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Use title and goal' })).toBeDefined();
    expect(screen.getByText('$0.01')).toBeDefined();
  });
  it('names replacement and shows the current fields', async () => {
    mount({ id: 'goalreplace' });
    expect(await screen.findByRole('button', { name: 'Replace' })).toBeDefined();
    expect(screen.getByText('Now: Fix credits')).toBeDefined();
    expect(screen.getByText('Now: Stop retrying credits.')).toBeDefined();
  });
  it('explains a title-only item', async () => {
    mount({ id: 'goaltitlesonly' });
    expect(
      await screen.findByText('Based on the titles of HL-211. Its text could not be read.'),
    ).toBeDefined();
  });
});
