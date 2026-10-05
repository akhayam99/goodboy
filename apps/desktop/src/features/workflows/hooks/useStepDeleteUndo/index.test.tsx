// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import { useAppStore } from '../../../../store/store';
import { blankStepDraft, type StepDraft } from '../../engine';
import { useStepDeleteUndo } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

const stepOf = (key: string, name: string): StepDraft => ({
  ...blankStepDraft(),
  key,
  name,
  role: 'implementer',
});

const STEPS = [stepOf('k1', 'Plan'), stepOf('k2', 'Build')];

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

type HookProps = { readonly contextKey: string };

const setup = () => {
  const setSteps = vi.fn();
  const view = renderHook(
    ({ contextKey }: HookProps) => useStepDeleteUndo({ steps: STEPS, setSteps, contextKey }),
    { wrapper, initialProps: { contextKey: 'wf-a' } },
  );
  return { setSteps, view };
};

beforeEach(() => {
  useAppStore.setState({ undoStack: [], undoNotices: [] });
});

afterEach(cleanup);

describe('useStepDeleteUndo', () => {
  it('puts the deleted step back while its editor context is still open', async () => {
    const { setSteps, view } = setup();
    act(() => view.result.current('k1'));
    setSteps.mockClear();

    let result = false;
    await act(async () => {
      result = await useAppStore.getState().undoLastOperation();
    });

    expect(result).toBe(true);
    expect(setSteps).toHaveBeenCalledTimes(1);
  });

  it('forgets the delete once the editor is closed', async () => {
    const { setSteps, view } = setup();
    act(() => view.result.current('k1'));
    setSteps.mockClear();
    view.unmount();

    let result = true;
    await act(async () => {
      result = await useAppStore.getState().undoLastOperation();
    });

    expect(result).toBe(false);
    expect(setSteps).not.toHaveBeenCalled();
    expect(useAppStore.getState().undoNotices.at(-1)?.toast.message).toBe('Nothing to undo.');
  });

  it('forgets the delete once the same editor shows another workflow', async () => {
    const { setSteps, view } = setup();
    act(() => view.result.current('k1'));
    setSteps.mockClear();
    view.rerender({ contextKey: 'wf-b' });

    let result = true;
    await act(async () => {
      result = await useAppStore.getState().undoLastOperation();
    });

    expect(result).toBe(false);
    expect(setSteps).not.toHaveBeenCalled();
  });
});
