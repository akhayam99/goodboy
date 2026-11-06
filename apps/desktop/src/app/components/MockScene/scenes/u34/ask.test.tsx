// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { NAMES } from '../../../../../shared/utils/names';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { U34_ASK_SCENES } from './ask';

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

afterEach(cleanup);

type MountParams = { readonly name: keyof typeof U34_ASK_SCENES };

const mount = ({ name }: MountParams) => {
  const Scene = U34_ASK_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the Ask as Chat studio scenes', () => {
  it('opens scoped to the session with the Chat composer', async () => {
    mount({ name: 'u34-u18-ask-first' });
    const drawer = await screen.findByRole('region', { name: 'Ask' });
    expect(within(drawer).queryByTestId('ask-scope')).toBeNull();
    expect(within(drawer).getAllByTestId('ask-composer')).toHaveLength(1);
  });

  it('shows the shared transcript with one Start work from this action', async () => {
    const { container } = mount({ name: 'u34-u18-ask-answer' });
    const drawer = await screen.findByRole('region', { name: 'Ask' });
    expect(container.querySelectorAll('[data-chat-message="user"]').length).toBeGreaterThan(0);
    const starts = await within(drawer).findAllByRole('button', { name: NAMES.startWorkFromAsk });
    expect(starts.length).toBeGreaterThan(0);
  });
});
