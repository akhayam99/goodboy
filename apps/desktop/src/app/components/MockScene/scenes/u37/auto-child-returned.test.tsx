// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U37_AUTO_CHILD_RETURNED_SCENES } from './auto-child-returned';

const WAIT = { timeout: 15_000 };

const REQUEST = 'Needs a shell to run the retry tests of payments-api on feature/ledger-drawers.';

beforeAll(async () => {
  await importStore();
  installFakeResizeObserver();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  clearSceneInvoke();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U37_AUTO_CHILD_RETURNED_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the auto-child-returned scenes', () => {
  it('registers the four states for the capture', () => {
    expect(Object.keys(U37_AUTO_CHILD_RETURNED_SCENES).sort()).toEqual([
      'auto-child-returned',
      'auto-child-returned-asks',
      'auto-child-returned-decided',
      'auto-child-returned-today',
    ]);
    for (const [id, Scene] of Object.entries(U37_AUTO_CHILD_RETURNED_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('Returned: the child reads Idle with the request it declared, never Failed', async () => {
    mount({ id: 'auto-child-returned' });

    await screen.findByText(`Returned to Auto: ${REQUEST}`, undefined, WAIT);
    expect(screen.queryByText(/Failed/)).toBeNull();
    expect(document.body.textContent).not.toContain('declared_blocked');
  });

  it('Today: a plain turn Done sits under the attempt, with the Failed sentence before it', async () => {
    mount({ id: 'auto-child-returned-today' });

    const failed = await screen.findByText(
      'Failed: The agent ended with an error.',
      undefined,
      WAIT,
    );
    const plain = await screen.findByText(
      'Done: the retry tests pass on feature/ledger-drawers.',
      undefined,
      WAIT,
    );
    expect(failed.compareDocumentPosition(plain) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(document.body.textContent).not.toContain('process_error');
  });

  it('Decided: a returned child that another role took on its branch is not Idle', async () => {
    mount({ id: 'auto-child-returned-decided' });

    await screen.findByText('Returned to Auto', undefined, WAIT);
    expect(screen.queryByText(/Failed/)).toBeNull();
    expect(screen.queryByText(`Returned to Auto: ${REQUEST}`)).toBeNull();
  });

  it('Asks you: Needs you is on Auto, never on the returned child', async () => {
    mount({ id: 'auto-child-returned-asks' });

    await screen.findAllByRole('list', { name: 'Delegations' }, WAIT);
    expect(screen.queryByText(/Failed/)).toBeNull();
    expect(document.body.textContent).not.toContain('declared_blocked');
  });
});
