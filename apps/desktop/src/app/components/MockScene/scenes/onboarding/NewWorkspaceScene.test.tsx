// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { NewWorkspaceScene, type NewWorkspaceSceneState } from './NewWorkspaceScene';

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
  readonly state: NewWorkspaceSceneState;
};

const mount = async ({ state }: MountParams) => {
  render(<NewWorkspaceScene state={state} theme="light" />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByRole('heading', { name: 'Your first workspace' })).toBeDefined();
};

describe('new workspace scenes', () => {
  it('opens on the drop area', async () => {
    await mount({ state: 'empty' });
    expect(screen.getByRole('button', { name: /drop a folder here/i })).toBeDefined();
  });

  it('reads one repository with its branch', async () => {
    await mount({ state: 'repo' });
    expect(screen.getByText('~/Code/acme-web')).toBeDefined();
    expect(screen.getByText('1 folder')).toBeDefined();
  });

  it('lists the repositories of a folder', async () => {
    await mount({ state: 'many' });
    expect(screen.getByText('Found 3 repositories in harborline.')).toBeDefined();
  });

  it('explains a plain folder', async () => {
    await mount({ state: 'plain' });
    expect(screen.getByText('Looks like documents: 24 Markdown files and 6 PDFs')).toBeDefined();
  });

  it('asks before moving a folder another workspace holds', async () => {
    await mount({ state: 'conflict' });
    expect(screen.getByRole('button', { name: 'Move it here' })).toBeDefined();
  });

  it('names the macOS refusal', async () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Macintosh');
    await mount({ state: 'denied' });
    expect(screen.getByRole('button', { name: 'Open Privacy settings' })).toBeDefined();
    userAgent.mockRestore();
  });

  it('starts from scratch', async () => {
    await mount({ state: 'scratch' });
    expect(screen.getByText('~/Code/acme-api')).toBeDefined();
  });
});
