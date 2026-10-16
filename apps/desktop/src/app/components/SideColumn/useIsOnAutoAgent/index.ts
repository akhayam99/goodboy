import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly currentSessionId: SessionId | null;
};

export const useIsOnAutoAgent = ({ currentSessionId }: Params): boolean =>
  useAppStore(
    (state) =>
      currentSessionId !== null &&
      state.activeLens[currentSessionId] === 'auto' &&
      (state.selectedAgentId[currentSessionId] ?? null) !== null,
  );
