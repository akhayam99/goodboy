// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_ANALYZE_FIX_SCENES } from './analyze-fix';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});
afterEach(() => {
  cleanup();
});

type Params = { readonly name: string };
const show = ({ name }: Params) => {
  const Scene = U24_ANALYZE_FIX_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown analyze fix scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('analyze fix scenes', () => {
  it('offers Start fix on the proposal row and in the drawer beside Dismiss', () => {
    show({ name: 'checks-proposal' });
    expect(screen.getByText('Debugger proposes a fix')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start fix' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const drawer = screen.getByRole('region', { name: 'Debugger' });
    expect(within(drawer).getByRole('button', { name: 'Start fix' })).toBeDefined();
    expect(within(drawer).getByText(/^Implementer · /)).toBeDefined();
    const chain = within(drawer).getByRole('list', { name: 'Agent chain' });
    expect(within(chain).getByText('Proposal')).toBeDefined();
    expect(within(chain).getByText('Waiting for you')).toBeDefined();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Dismiss' }));
    expect(
      within(drawer).getByText('Dismissed. Analyze again for another proposal.'),
    ).toBeDefined();
    expect(within(chain).getByText('Dismissed')).toBeDefined();
    expect(within(drawer).queryByRole('button', { name: 'Start fix' })).toBeNull();
  });
  it('shows the Implementer fixing in the row and in the chain', () => {
    show({ name: 'checks-fixing' });
    expect(screen.getByText('Implementer is fixing')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start fix' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const drawer = screen.getByRole('region', { name: 'Debugger' });
    expect(within(drawer).getByText('Implementer is applying it on the branch.')).toBeDefined();
    const chain = within(drawer).getByRole('list', { name: 'Agent chain' });
    expect(within(chain).getByText('Accepted')).toBeDefined();
    expect(within(chain).getByText('Fix')).toBeDefined();
  });
  it('shows the Debugger as the one row for the chain in Activity', () => {
    show({ name: 'activity-check-chain' });
    expect(screen.getAllByText('CI fix · payments-api / test · #318').length).toBeGreaterThan(0);
    expect(screen.queryByText('Implementer')).toBeNull();
    const next = screen.getByRole('region', { name: 'Next' });
    expect(within(next).getByText('Fixing payments-api / test on #318')).toBeDefined();
    expect(within(next).getByRole('button', { name: 'Open' })).toBeDefined();
    expect(within(next).queryByRole('button', { name: 'Push' })).toBeNull();
    expect(screen.queryByText('Review the changes')).toBeNull();
  });
  it.each(Object.keys(U24_ANALYZE_FIX_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = show({ name });
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
