// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../../../store';
import { captureLocation } from '../../../../../store/slices/navigation/captureLocation';
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

beforeAll(async () => {
  await importStore();
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
    ['run', 'Back to runs'],
    ['step', 'Back to run'],
    ['agent', 'Back to runs'],
    ['artifact', 'Back to artifacts'],
    ['branch-file', 'Back to branch'],
  ])('draws one back row and no trail on the %s page', async (slug, label) => {
    mount({ id: `u27-breadcrumbs-after-${slug}-light` });
    const back = await screen.findByRole('button', { name: label });

    expect(back.closest('[data-session-back]')).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('closes the branch file on a deep link when Back to branch is clicked', async () => {
    mount({ id: 'u27-breadcrumbs-after-branch-file-light' });
    const back = await screen.findByRole('button', { name: 'Back to branch' });
    expect(useAppStore.getState().diffFocus[FLOW_SESSION_ID]?.path).not.toBeNull();

    fireEvent.click(back);

    await waitFor(() => {
      expect(useAppStore.getState().diffFocus[FLOW_SESSION_ID]?.path ?? null).toBeNull();
    });
    expect(screen.queryByRole('button', { name: 'Back to branch' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to overview' })).toBeDefined();
  });

  it('goes back in history to the branch page when one sits below the file', async () => {
    mount({ id: 'u27-breadcrumbs-after-branch-file-light' });
    await screen.findByRole('button', { name: 'Back to branch' });
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

    fireEvent.click(await screen.findByRole('button', { name: 'Back to branch' }));

    await waitFor(() => {
      expect(useAppStore.getState().diffFocus[FLOW_SESSION_ID]?.path ?? null).toBeNull();
    });
    expect(useAppStore.getState().navigation[stackKeyOf()]?.index).toBe(depth - 1);
    expect(screen.queryByRole('button', { name: 'Back to branch' })).toBeNull();
  });
});
