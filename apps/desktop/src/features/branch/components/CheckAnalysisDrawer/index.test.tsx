// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { sceneInvoke, clearSceneInvoke } from '../../../../test/sceneInvoke';
import { U24_CHECKS_ANALYZE_SCENES } from '../../../../app/components/MockScene/scenes/u24/checks-analyze';
import { U25_DEBUGGER_SCENES } from '../../../../app/components/MockScene/scenes/u25/debugger';

const SCENES = { ...U24_CHECKS_ANALYZE_SCENES, ...U25_DEBUGGER_SCENES };

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
const showDrawer = ({ name }: Params) => {
  const Scene = SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  return screen.getByRole('region', { name: 'Debugger' });
};

describe('the Debugger drawer', () => {
  it('reads as steps and prose, with the references behind rows', () => {
    const drawer = showDrawer({ name: 'debugger-drawer-proposal' });
    for (const name of ['Finding', 'Proposed fix']) {
      expect(within(drawer).getByRole('heading', { level: 3, name })).toBeDefined();
    }
    for (const name of ['Activity', 'What it was given', 'Failed log tail']) {
      expect(within(drawer).queryByRole('heading', { level: 3, name })).toBeNull();
    }
    for (const name of ['What it was given', 'Failed log tail']) {
      expect(within(drawer).getByRole('button', { name }).getAttribute('aria-expanded')).toBe(
        'false',
      );
    }
    const chain = within(drawer).getByRole('list', { name: 'Agent chain' });
    expect(within(chain).getAllByRole('listitem')).toHaveLength(2);
    expect(within(chain).getByText('Proposal')).toBeDefined();
    expect(within(chain).getByText('Waiting for you')).toBeDefined();
    expect(within(drawer).queryByText('Sonnet 5.5')).toBeNull();
    expect(within(drawer).getByRole('button', { name: /^Transcript of / })).toBeDefined();
  });
  it('says Running with the live step while the analysis works', () => {
    const drawer = showDrawer({ name: 'debugger-drawer-running' });
    expect(
      within(drawer).getByText('Running · Running the retry reproduction in ledger-core.'),
    ).toBeDefined();
    const chain = within(drawer).getByRole('list', { name: 'Agent chain' });
    expect(within(chain).getAllByRole('listitem')).toHaveLength(1);
    expect(within(chain).getByText('Analyze')).toBeDefined();
    expect(within(drawer).queryByRole('button', { name: /^Start/ })).toBeNull();
  });
  it('reads what it was given as facts and hides the paths behind a file count', () => {
    const drawer = showDrawer({ name: 'debugger-drawer-proposal' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'What it was given' }));
    expect(within(drawer).getByText('Pull request').nextElementSibling?.textContent).toBe('#318');
    expect(within(drawer).getByText('Head').nextElementSibling?.textContent).toBe('a13bc4d');
    expect(within(drawer).getByText('Check').nextElementSibling?.textContent).toBe(
      'payments-api / test',
    );
    expect(within(drawer).getByText('Conclusion').nextElementSibling?.textContent).toBe('failure');
    expect(
      within(drawer).getByRole('button', { name: 'Open check run for payments-api / test' }),
    ).toBeDefined();
    const files = within(drawer).getByRole('button', { name: '2 files' });
    expect(files.getAttribute('aria-expanded')).toBe('false');
    expect(within(drawer).queryByText('src/ledger.test.ts')).toBeNull();
    fireEvent.click(files);
    expect(
      within(within(drawer).getByRole('list', { name: 'Paths' })).getAllByRole('listitem'),
    ).toHaveLength(2);
  });
  it('offers one fix as a plain box with Start fix', () => {
    const drawer = showDrawer({ name: 'debugger-drawer-proposal' });
    expect(within(drawer).queryByRole('tablist', { name: 'Fix options' })).toBeNull();
    expect(within(drawer).getByRole('button', { name: 'Start fix' })).toBeDefined();
    expect(
      within(drawer).getByRole('region', { name: 'Proposed diff for src/ledger.ts' }),
    ).toBeDefined();
  });
  it('shows the options as cards with the recommended one selected and tagged', () => {
    const drawer = showDrawer({ name: 'debugger-drawer-options' });
    const tabs = within(within(drawer).getByRole('tablist', { name: 'Fix options' })).getAllByRole(
      'tab',
    );
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(tabs[0]?.textContent).toContain('Option A: Guard in the ledger');
    expect(tabs[0]?.textContent).toContain('Recommended');
    expect(tabs[1]?.textContent).not.toContain('Recommended');
    expect(tabs[0]?.textContent).toContain('Skip applyCredit in src/ledger.ts');
    expect(tabs[1]?.textContent).toContain('Drop repeated invoice ids in src/retryQueue.ts');
    expect(tabs[2]?.textContent).toContain('Add an idempotency key to every credit');
    expect(tabs[0]?.textContent).not.toContain('--- a/src/ledger.ts');
    expect(within(drawer).getByRole('tabpanel', { name: 'Option A' })).toBeDefined();
    expect(
      within(drawer).getByText(
        'It is the smallest change and the guard also protects every other caller.',
        { exact: false },
      ),
    ).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'Start option A' })).toBeDefined();
    expect(within(drawer).queryByRole('button', { name: 'Start fix' })).toBeNull();
  });
  it('follows the picked option in the body and in the CTA', () => {
    const drawer = showDrawer({ name: 'debugger-drawer-options' });
    fireEvent.click(within(drawer).getByRole('tab', { name: /Option B/ }));
    expect(within(drawer).getByRole('button', { name: 'Start option B' })).toBeDefined();
    const panel = within(drawer).getByRole('tabpanel', { name: 'Option B' });
    expect(within(panel).getByText('Drop repeated invoice ids', { exact: false })).toBeDefined();
    expect(within(panel).queryByText('Skip applyCredit', { exact: false })).toBeNull();
    expect(
      within(drawer).queryByRole('region', { name: 'Proposed diff for src/ledger.ts' }),
    ).toBeNull();
    fireEvent.click(within(drawer).getByRole('tab', { name: /Option C/ }));
    expect(within(drawer).getByRole('button', { name: 'Start option C' })).toBeDefined();
  });
  it('keeps the failed log collapsed and shows it without escape codes or CI prefixes', () => {
    const drawer = showDrawer({ name: 'debugger-drawer-ci-log' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Failed log tail' }));
    const toggle = within(drawer).getByRole('button', { name: /payments-api \/ test\s*\d+ lines/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(drawer).queryByLabelText('Log of payments-api / test')).toBeNull();
    fireEvent.click(toggle);
    const text = within(drawer).getByLabelText('Log of payments-api / test').textContent ?? '';
    expect(text).toMatch(/FAIL\s+src\/ledger\.test\.ts/);
    expect(text).toContain('== Run tests');
    expect(text).not.toContain(String.fromCharCode(0x1b));
    expect(text).not.toContain('[31m');
    expect(text).not.toContain('UNKNOWN STEP');
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
