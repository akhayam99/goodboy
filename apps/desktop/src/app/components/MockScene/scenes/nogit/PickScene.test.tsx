// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { PickScene, type PickSceneState } from './PickScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly state: PickSceneState;
};

const mount = async ({ state }: MountParams) => {
  render(<PickScene state={state} theme="light" />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  return within(screen.getByRole('list', { name: 'Folders' }));
};

const selectedFace = (name: string) =>
  within(screen.getByRole('tablist', { name: `What ${name} is for` }))
    .getAllByRole('tab')
    .find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent ?? null;

describe('the pick scenes of a plain folder', () => {
  it('code preselects Code project from a package.json and offers git, unticked', async () => {
    const row = await mount({ state: 'code' });

    expect(row.getByText('Looks like code: a package.json and 214 source files')).toBeDefined();
    expect(selectedFace('acme-web')).toMatch(/^Code project/);
    expect(row.getByRole('checkbox', { name: /Track it with git/ })).toHaveProperty(
      'checked',
      false,
    );
  });

  it('docs preselects Documents from 86 Markdown files and says what stays read only', async () => {
    const row = await mount({ state: 'docs' });

    expect(row.getByText('Looks like documents: 86 Markdown files and 12 PDFs')).toBeDefined();
    expect(selectedFace('acme-notes')).toMatch(/^Documents/);
    expect(row.getByText(/Word, PDF, Pages and Keynote files stay read only/)).toBeDefined();
  });

  it('inside asks the whole repository or only this folder', async () => {
    const row = await mount({ state: 'inside' });

    expect(row.getByText('handbook is inside the git repository harborline.')).toBeDefined();
    expect(row.getByRole('tab', { name: /The whole repository/ })).toBeDefined();
    expect(row.getByRole('tab', { name: /Only this folder/ })).toBeDefined();
  });

  it('big says the size and that larger files keep no versions', async () => {
    const row = await mount({ state: 'big' });

    expect(row.getByText('Looks like documents: 640 files, most of them video')).toBeDefined();
    expect(row.getByText('acme-research holds 38 GB, mostly video.')).toBeDefined();
  });
});
