import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, useSessions } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { mergeFactsOf } from '../../reads/mergeFactsOf';
import { mergedSinceOf, type MergedWeek } from '../../reads/mergedSinceOf';

const CLOCK_MS = 60_000;

export const useMergedWeek = (): MergedWeek => {
  const sessions = useSessions();
  const merges = useAppStore(useShallow((state) => mergeFactsOf({ state, sessions })));
  const nowMs = useNow(CLOCK_MS);
  return useMemo(() => mergedSinceOf({ merges, nowMs }), [merges, nowMs]);
};
