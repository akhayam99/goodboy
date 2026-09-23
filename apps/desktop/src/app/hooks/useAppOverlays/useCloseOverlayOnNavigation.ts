import { useEffect } from 'react';
import { useAppStore } from '../../../store';
import type { AppState } from '../../../store/types';

type Params = {
  readonly close: () => void;
};

type NavigationState = Pick<AppState, 'currentWorkspaceId' | 'currentSessionId' | 'activeLens'>;

const currentLens = (state: NavigationState) =>
  state.currentSessionId === null ? null : (state.activeLens[state.currentSessionId] ?? null);

type NavigationParams = {
  readonly state: NavigationState;
  readonly prev: NavigationState;
};

const hasNavigated = ({ state, prev }: NavigationParams): boolean =>
  state.currentWorkspaceId !== prev.currentWorkspaceId ||
  state.currentSessionId !== prev.currentSessionId ||
  currentLens(state) !== currentLens(prev);

export const useCloseOverlayOnNavigation = ({ close }: Params) => {
  useEffect(
    () =>
      useAppStore.subscribe((state, prev) => {
        if (!hasNavigated({ state, prev })) {
          return;
        }
        close();
      }),
    [close],
  );
};
