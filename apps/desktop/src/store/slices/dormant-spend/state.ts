import type { DormantTelemetry } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';

type DormantSpend = {
  readonly workspaceId: WorkspaceId;
  readonly entries: ReadonlyArray<DormantTelemetry>;
};

export type DormantSpendState = {
  readonly dormantSpend: DormantSpend | null;
};

export const dormantSpendInitialState: DormantSpendState = {
  dormantSpend: null,
};
