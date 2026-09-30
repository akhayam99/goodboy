import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { SummarizerSessionStatus } from './state';

const IDLE_STATUS: SummarizerSessionStatus = {
  status: 'idle',
  lastUpdate: null,
  error: null,
  lastUsage: null,
  lastAttempt: null,
};

export const useSummarizerStatus = (sessionId: SessionId | null): SummarizerSessionStatus =>
  useAppStore((s) => (sessionId ? (s.summarizerStatus[sessionId] ?? IDLE_STATUS) : IDLE_STATUS));
