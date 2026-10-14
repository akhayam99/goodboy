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
import { U24_FIX_HINTS_SCENES } from './fix-hints';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
});

type Params = { readonly name: string };
const show = ({ name }: Params) => {
  const Scene = U24_FIX_HINTS_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown fix-hints scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('fix-hints scenes', () => {
  it('opens the Fix comments drawer with the hint filled and the launch ready', async () => {
    show({ name: 'fixcomments-hint-filled' });

    const drawer = await screen.findByRole('region', { name: 'Fix comments' });

    const field = within(drawer).getByRole('textbox', { name: 'Hint for the agent' });
    expect(field).toHaveProperty('value', expect.stringContaining('Skip the naming nit'));
    expect(within(drawer).getByRole('button', { name: 'Clear hint' })).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'Start fix for 3' })).toBeDefined();
  });

  it('opens the Debugger drawer with the Implementer hint filled', async () => {
    show({ name: 'debugger-drawer-hint-filled' });

    const field = await screen.findByRole('textbox', { name: 'Hint for the Implementer' });

    expect(field).toHaveProperty(
      'value',
      expect.stringContaining('Keep the guard inside ledger.ts'),
    );
    const drawer = screen.getByRole('region', { name: 'Debugger' });
    expect(within(drawer).getByRole('button', { name: 'Start fix' })).toBeDefined();
  });

  it('clears the hint with the x and keeps the line for another try', async () => {
    show({ name: 'fixcomments-hint-filled' });
    const drawer = await screen.findByRole('region', { name: 'Fix comments' });

    fireEvent.click(within(drawer).getByRole('button', { name: 'Clear hint' }));

    expect(within(drawer).getByRole('textbox', { name: 'Hint for the agent' })).toHaveProperty(
      'value',
      '',
    );
  });

  it.each(Object.keys(U24_FIX_HINTS_SCENES))('%s has no accessibility violations', async (name) => {
    const { container } = show({ name });
    await screen.findByRole('textbox', { name: /^Hint for the/ });
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
