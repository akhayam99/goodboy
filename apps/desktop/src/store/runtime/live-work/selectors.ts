import { useAppStore } from '../../store';
import type { AppState } from '../../types';
import { selectLiveWork } from './selectLiveWork';

const selectRunningHere = (state: AppState): number =>
  selectLiveWork({ state }).liveSessionIds.length;

export const useRunningHere = (): number => useAppStore(selectRunningHere);
