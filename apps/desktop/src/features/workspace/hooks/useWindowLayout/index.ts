import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import type { AppStore } from '../../../../store/store';
import { captureWindowLocation } from '../../../../store/slices/navigation/captureWindowLocation';
import { currentWindowLabel, onWindowClose } from '../../window';
import { forgetWindowLayout, saveWindowLayout } from '../../windowLayout';

export const WINDOW_LAYOUT_SAVE_DELAY_MS = 500;

const layoutInputs = (state: AppStore): ReadonlyArray<unknown> => [
  state.currentWorkspaceId,
  state.currentSessionId,
  state.activeLens,
  state.selectedAgentId,
  state.sessionStudio,
  state.drawer,
  state.appStudio,
  state.navigation,
  state.focusedWorkflowRunId,
  state.focusedArtifactId,
  state.focusedGithubIssueNumber,
  state.focusedExternalTask,
  state.diffFocus,
  state.diffMountPath,
  state.branchTab,
  state.branchThreadId,
  state.terminalMountPath,
];

const isSameInputs = (left: ReadonlyArray<unknown>, right: ReadonlyArray<unknown>): boolean =>
  left.every((value, index) => Object.is(value, right[index]));

const persist = async ({
  state,
  label,
}: {
  readonly state: AppStore;
  readonly label: string;
}): Promise<void> => {
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId === null) {
    await forgetWindowLayout({ label });
    return;
  }
  await saveWindowLayout({
    label,
    workspaceId,
    location: captureWindowLocation({ state }),
    at: Date.now(),
  });
};

export const useWindowLayout = (): void => {
  const isHydrated = useAppStore((state) => state.hydrated);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const label = currentWindowLabel();
    let isClosing = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = layoutInputs(useAppStore.getState());
    const schedule = () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        if (isClosing) {
          return;
        }
        void persist({ state: useAppStore.getState(), label }).catch(() => undefined);
      }, WINDOW_LAYOUT_SAVE_DELAY_MS);
    };
    schedule();
    const unsubscribe = useAppStore.subscribe((state) => {
      const next = layoutInputs(state);
      if (isSameInputs(next, last)) {
        return;
      }
      last = next;
      schedule();
    });
    let unlistenClose: (() => void) | undefined;
    let isActive = true;
    void onWindowClose(() => {
      isClosing = true;
      void forgetWindowLayout({ label }).catch(() => undefined);
    }).then((off) => {
      if (!isActive) {
        off();
        return;
      }
      unlistenClose = off;
    });
    return () => {
      isActive = false;
      unsubscribe();
      unlistenClose?.();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [isHydrated]);
};
