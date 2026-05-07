import type { SessionId, TurnEvent } from '@kay-am/types';
import { useAppStore, type AppState } from './store';

const EMPTY: ReadonlyArray<TurnEvent> = [];

export const selectTranscript =
  (sessionId: SessionId | null) =>
  (state: AppState): ReadonlyArray<TurnEvent> =>
    sessionId ? (state.transcripts[sessionId] ?? EMPTY) : EMPTY;

export function useTranscript(sessionId: SessionId | null): ReadonlyArray<TurnEvent> {
  return useAppStore(selectTranscript(sessionId));
}
