// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { captureLocation } from '../../../../../store/slices/navigation/captureLocation';
import { escapeLadder } from '../../../../../features/session/escapeLadder';
import { stackKey } from '../../../../../store/slices/navigation/currentStack';
import { FLOW_SESSION_ID } from '../flow-audit/fixtures';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U27_BREADCRUMBS_SCENES } from './breadcrumbs';

type Store = Awaited<ReturnType<typeof importStore>>;

let useAppStore: Store;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const stackKeyOf = (): string => stackKey(useAppStore.getState());

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U27_BREADCRUMBS_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('breadcrumbs scenes', () => {
  it('registers a light and a dark after scene per place', () => {
    for (const [name, Scene] of Object.entries(U27_BREADCRUMBS_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
    expect(Object.keys(U27_BREADCRUMBS_SCENES)).toHaveLength(10);
  });

  it.each<readonly [string, string]>([
    ['run', 'Runs'],
    ['step', 'Duplicate credit fix'],
    ['artifact', 'Artifacts'],
  ])('draws the session crumbs and no back row on the %s page', async (slug, parent) => {
    mount({ id: `u27-breadcrumbs-after-${slug}-light` });
    const crumbs = await screen.findByRole('navigation', { name: 'Breadcrumb' });

    within(crumbs).getByRole('button', { name: parent });
    expect(document.querySelector('[data-session-back]')).toBeNull();
    expect(document.querySelector('[data-slot="trail"]')).toBeNull();
  });

  it.each(['agent', 'branch-file'])(
    'draws the session and the item as the crumbs of the %s page',
    async (slug) => {
      mount({ id: `u27-breadcrumbs-after-${slug}-light` });
      const crumbs = await screen.findByRole('navigation', { name: 'Breadcrumb' });

      expect(within(crumbs).getAllByRole('listitem')).toHaveLength(2);
      expect(document.querySelector('[data-session-back]')).toBeNull();
    },
  );

  it('closes the branch file on a deep link on Esc, then goes to the overview', async () => {
    mount({ id: 'u27-breadcrumbs-after-branch-file-light' });
    await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(useAppStore.getState().diffFocus[FLOW_SESSION_ID]?.path).not.toBeNull();

    act(() => escapeLadder({}));

    await waitFor(() => {
      expect(useAppStore.getState().diffFocus[FLOW_SESSION_ID]?.path ?? null).toBeNull();
    });
    act(() => escapeLadder({}));
    await waitFor(() => {
      const { place } = captureLocation({ state: useAppStore.getState() });
      expect(place.at === 'session' ? place.view.target : 'none').toBeNull();
    });
  });

  it('goes back in history to the branch page when one sits below the file', async () => {
    mount({ id: 'u27-breadcrumbs-after-branch-file-light' });
    await screen.findByRole('navigation', { name: 'Breadcrumb' });
    const file = captureLocation({ state: useAppStore.getState() }).place;
    if (file.at !== 'session' || file.view.target?.kind !== 'branch') {
      throw new Error('scene is not on a branch file');
    }
    const { target } = file.view;
    act(() => {
      useAppStore.getState().navigate({
        to: { ...file, view: { ...file.view, target: { ...target, focus: null } } },
      });
      useAppStore.getState().navigate({ to: file });
    });
    const depth = useAppStore.getState().navigation[stackKeyOf()]?.index ?? 0;

    act(() => escapeLadder({}));

    await waitFor(() => {
      expect(useAppStore.getState().diffFocus[FLOW_SESSION_ID]?.path ?? null).toBeNull();
    });
    expect(useAppStore.getState().navigation[stackKeyOf()]?.index).toBe(depth - 1);
  });
});
