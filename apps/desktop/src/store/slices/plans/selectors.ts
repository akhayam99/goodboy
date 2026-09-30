import type { PlanWithCount, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

const EMPTY_PLANS: ReadonlyArray<PlanWithCount> = [];

export const useSessionPlans = (sessionId: SessionId | null): ReadonlyArray<PlanWithCount> =>
  useAppStore((s) => (sessionId ? (s.sessionPlans[sessionId] ?? EMPTY_PLANS) : EMPTY_PLANS));
