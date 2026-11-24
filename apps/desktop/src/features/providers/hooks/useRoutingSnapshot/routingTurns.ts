import type { ProviderAgentTurns } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { readProviderAgentTurns } from '../../../../store/runtime/models/readProviderAgentTurns';
import { createLatestOnly } from '../../../../store/runtime/state-writes/latestOnly';

export type TurnsRead = Readonly<{
  workspaceId: WorkspaceId;
  nowMs: number;
  turns: ReadonlyArray<ProviderAgentTurns>;
}>;

type RequestParams = {
  readonly workspaceId: WorkspaceId;
  readonly nowMs: number;
  readonly runningKey: string;
};

type ListenParams = {
  readonly listener: () => void;
};

const READ_KEY = 'routing-turns';

const latest = createLatestOnly();

const listeners = new Set<() => void>();

const shared: { read: TurnsRead | null; requested: string | null } = {
  read: null,
  requested: null,
};

type ReadParams = {
  readonly workspaceId: WorkspaceId;
  readonly nowMs: number;
};

const readTurns = async ({ workspaceId, nowMs }: ReadParams): Promise<void> => {
  const claimed = latest.claim({ key: READ_KEY });
  const turns = await readProviderAgentTurns({ nowMs });
  if (!claimed.isCurrent()) {
    return;
  }
  shared.read = { workspaceId, nowMs, turns };
  listeners.forEach((listener) => listener());
};

export const routingTurns = {
  current: (): TurnsRead | null => shared.read,
  subscribe: ({ listener }: ListenParams): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  request: ({ workspaceId, nowMs, runningKey }: RequestParams): void => {
    const key = `${workspaceId}|${nowMs}|${runningKey}`;
    if (key === shared.requested) {
      return;
    }
    shared.requested = key;
    void readTurns({ workspaceId, nowMs });
  },
};
