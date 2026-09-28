import type { AgentTurnSpan, MountId, ProviderId, ProviderRunId } from '@goodboy/types';

const CURSOR_PREFIX = 'goodboy:turn-cursor:';

export type TurnOwner = Omit<
  AgentTurnSpan,
  'runId' | 'provider' | 'endedAt' | 'endReason' | 'touchedMountIds'
> & {
  readonly provider: ProviderId;
  readonly workingDir: string;
  readonly mountId: MountId | null;
};

export type TurnCursor = {
  readonly seq: number;
  readonly index: number;
  readonly owner: TurnOwner | null;
};

type RunParams = {
  readonly runId: ProviderRunId;
};

type WriteParams = RunParams & {
  readonly cursor: TurnCursor;
};

const keyFor = ({ runId }: RunParams): string => `${CURSOR_PREFIX}${runId}`;

const isCursor = (value: unknown): value is TurnCursor => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.seq === 'number' && typeof candidate.index === 'number';
};

export const readTurnCursor = ({ runId }: RunParams): TurnCursor | null => {
  try {
    const raw = sessionStorage.getItem(keyFor({ runId }));
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isCursor(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeTurnCursor = ({ runId, cursor }: WriteParams): void => {
  try {
    sessionStorage.setItem(keyFor({ runId }), JSON.stringify(cursor));
  } catch {
    return;
  }
};

export const clearTurnCursor = ({ runId }: RunParams): void => {
  try {
    sessionStorage.removeItem(keyFor({ runId }));
  } catch {
    return;
  }
};
