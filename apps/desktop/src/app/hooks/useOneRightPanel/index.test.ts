// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { DrawerRequest } from '../../../store/slices/drawer/state';
import type { StudioDrawerSpec } from '../../../shared/components/StudioShell/studioFrameContext';
import { useOneRightPanel } from './index';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });

const TERMINAL: DrawerRequest = {
  kind: 'terminal',
  sessionId: null,
  payload: { terminalId: brandId({ value: 'tab-harborline-dev' }) },
};

type SpecParams = {
  readonly key: string | null;
  readonly onClose: () => void;
};

const specOf = ({ key, onClose }: SpecParams): StudioDrawerSpec | null =>
  key === null
    ? null
    : { node: 'record', drawerKey: key, onClose, ariaLabel: 'Task', resizeLabel: 'Resize' };

type HookProps = {
  readonly key: string | null;
};

const CLOSED: HookProps = { key: null };

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ workspaces: [workspace], currentWorkspaceId: workspace.id });
  useAppStore.getState().openStudio({ studio: { kind: 'inbox', focus: null } });
});

afterEach(cleanup);

describe('the page panel and the dock share one right side', () => {
  it('closes the page panel when the dock opens, latest wins', () => {
    const onClose = vi.fn();
    const { result } = renderHook(
      ({ key }: HookProps) => useOneRightPanel({ spec: specOf({ key, onClose }), isActive: true }),
      { initialProps: { key: 'payments-api#12' } },
    );
    expect(result.current).toBe(true);

    act(() => useAppStore.getState().openDrawer(TERMINAL));

    expect(onClose).toHaveBeenCalledOnce();
    expect(result.current).toBe(false);
  });

  it('closes the dock when a page panel opens after it', () => {
    act(() => useAppStore.getState().openDrawer(TERMINAL));
    const { result, rerender } = renderHook(
      ({ key }: HookProps) =>
        useOneRightPanel({ spec: specOf({ key, onClose: vi.fn() }), isActive: true }),
      { initialProps: CLOSED },
    );

    rerender({ key: 'payments-api#12' });

    expect(useAppStore.getState().drawer).toBeNull();
    expect(result.current).toBe(true);
  });

  it('leaves both alone on a page that hosts no panel', () => {
    const onClose = vi.fn();
    renderHook(() =>
      useOneRightPanel({ spec: specOf({ key: 'payments-api#12', onClose }), isActive: false }),
    );

    act(() => useAppStore.getState().openDrawer(TERMINAL));

    expect(onClose).not.toHaveBeenCalled();
    expect(useAppStore.getState().drawer).toEqual(TERMINAL);
  });
});
