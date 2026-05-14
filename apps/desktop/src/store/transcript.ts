import { useRef } from 'react';
import type { SessionId, TurnEvent } from '@kay-am/types';
import { useAppStore, type AppState } from './store';

const EMPTY: ReadonlyArray<TurnEvent> = [];

const selectTranscript =
  (agentId: SessionId | null) =>
  (state: AppState): ReadonlyArray<TurnEvent> =>
    agentId ? (state.transcripts[agentId] ?? EMPTY) : EMPTY;

export function useTranscript(agentId: SessionId | null): ReadonlyArray<TurnEvent> {
  const idRef = useRef<SessionId | null>(agentId);
  const selectorRef = useRef<(state: AppState) => ReadonlyArray<TurnEvent>>(
    selectTranscript(agentId),
  );
  if (idRef.current !== agentId) {
    idRef.current = agentId;
    selectorRef.current = selectTranscript(agentId);
  }
  return useAppStore(selectorRef.current);
}
