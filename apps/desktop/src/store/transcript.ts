import { useRef } from 'react';
import type { AgentId, TurnEvent } from '@goodboy/types';
import { useAppStore } from './store';
import type { AppState } from './types';

const EMPTY: ReadonlyArray<TurnEvent> = [];

const selectTranscript =
  (agentId: AgentId | null) =>
  (state: AppState): ReadonlyArray<TurnEvent> =>
    agentId ? (state.transcripts[agentId] ?? EMPTY) : EMPTY;

export const useTranscript = (agentId: AgentId | null): ReadonlyArray<TurnEvent> => {
  const idRef = useRef<AgentId | null>(agentId);
  const selectorRef = useRef<(state: AppState) => ReadonlyArray<TurnEvent>>(
    selectTranscript(agentId),
  );
  if (idRef.current !== agentId) {
    idRef.current = agentId;
    selectorRef.current = selectTranscript(agentId);
  }
  return useAppStore(selectorRef.current);
};
