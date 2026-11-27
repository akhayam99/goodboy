import { AUTO_LEAD_FRESH_GAP_MS } from './limits';

export type LeadDeliveryMode = 'full' | 'fresh' | 'delta';

export type LeadLastTurn = Readonly<{
  endedAtMs: number;
  model: string | null;
}>;

export type LeadDeliveryModeParams = Readonly<{
  resumeSessionId: string | null;
  baselineSessionId: string | null;
  lastTurn: LeadLastTurn | null;
  model: string;
  nowMs: number;
}>;

export const leadDeliveryModeOf = ({
  resumeSessionId,
  baselineSessionId,
  lastTurn,
  model,
  nowMs,
}: LeadDeliveryModeParams): LeadDeliveryMode => {
  if (resumeSessionId === null) {
    return 'full';
  }
  if (lastTurn !== null) {
    const isCold = nowMs - lastTurn.endedAtMs > AUTO_LEAD_FRESH_GAP_MS;
    const hasModelChanged = lastTurn.model !== null && lastTurn.model !== model;
    if (isCold || hasModelChanged) {
      return 'fresh';
    }
  }
  if (baselineSessionId !== resumeSessionId) {
    return 'full';
  }
  return 'delta';
};
