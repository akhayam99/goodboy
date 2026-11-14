import { act } from '@testing-library/react';
import { useAppStore, type LensKind } from '../../../../store';

type Params = {
  readonly lens: LensKind | null;
};

export const openSessionLens = async ({ lens }: Params): Promise<void> => {
  await act(async () => {
    useAppStore.setState((state) => {
      const sessionId = state.currentSessionId;
      if (sessionId === null) {
        return state;
      }
      return { activeLens: { ...state.activeLens, [sessionId]: lens } };
    });
  });
};
