import { useRef } from 'react';
import type { TaskId, TurnEvent } from '@kay-am/types';
import { useAppStore, type AppState } from './store';

const EMPTY: ReadonlyArray<TurnEvent> = [];

export const selectTranscript =
  (taskId: TaskId | null) =>
  (state: AppState): ReadonlyArray<TurnEvent> =>
    taskId ? (state.transcripts[taskId] ?? EMPTY) : EMPTY;

export function useTranscript(taskId: TaskId | null): ReadonlyArray<TurnEvent> {
  const idRef = useRef<TaskId | null>(taskId);
  const selectorRef = useRef<(state: AppState) => ReadonlyArray<TurnEvent>>(
    selectTranscript(taskId),
  );
  if (idRef.current !== taskId) {
    idRef.current = taskId;
    selectorRef.current = selectTranscript(taskId);
  }
  return useAppStore(selectorRef.current);
}
