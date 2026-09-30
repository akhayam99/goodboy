import type { AgentTurnSpan, MountId, ProviderId, ProviderRunId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../shared/lib/storage-keys';

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

const keyFor = ({ runId }: RunParams): string => `${STORAGE_PREFIXES.turnCursor}${runId}`;

const isCursor = (value: unknown): value is TurnCursor => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.seq === 'number' && typeof candidate.index === 'number';
};

const cursorPref = ({ runId }: RunParams) =>
  persistedPref<TurnCursor | null>({
    key: keyFor({ runId }),
    area: 'session',
    fallback: null,
    parse: (raw) => {
      const parsed: unknown = JSON.parse(raw);
      return isCursor(parsed) ? parsed : undefined;
    },
  });

export const readTurnCursor = ({ runId }: RunParams): TurnCursor | null =>
  cursorPref({ runId }).read();

export const writeTurnCursor = ({ runId, cursor }: WriteParams): void =>
  cursorPref({ runId }).write(cursor);

export const clearTurnCursor = ({ runId }: RunParams): void => cursorPref({ runId }).clear();
