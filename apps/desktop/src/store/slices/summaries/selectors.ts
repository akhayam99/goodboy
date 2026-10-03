import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { SummarizerPending, SummarizerRound, SummarizerSessionStatus } from './state';

const IDLE_STATUS: SummarizerSessionStatus = {
  status: 'idle',
  lastUpdate: null,
  error: null,
  lastUsage: null,
  lastAttempt: null,
};

export const useSummarizerStatus = (sessionId: SessionId | null): SummarizerSessionStatus =>
  useAppStore((s) => (sessionId ? (s.summarizerStatus[sessionId] ?? IDLE_STATUS) : IDLE_STATUS));

const NO_PENDING: SummarizerPending = { turns: 0, isUpdateQueued: false };

export const useSummarizerRound = (sessionId: SessionId): SummarizerRound | null =>
  useAppStore((s) => s.summarizerRounds[sessionId] ?? null);

export const useSummarizerPending = (sessionId: SessionId): SummarizerPending =>
  useAppStore((s) => s.summarizerPending[sessionId] ?? NO_PENDING);
