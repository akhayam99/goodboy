import type { WorkspaceId } from '@goodboy/types';

type PersistParams<Row> = {
  readonly confirmed: Row | undefined;
};

type EnqueueParams<Row> = {
  readonly workspaceId: WorkspaceId;
  readonly previous: Row | undefined;
  readonly persist: (params: PersistParams<Row>) => Promise<Row>;
};

type WorkspaceWriteOutcome<Row> =
  | { readonly ok: true; readonly stored: Row; readonly isLast: boolean }
  | {
      readonly ok: false;
      readonly error: unknown;
      readonly confirmed: Row | undefined;
      readonly isLast: boolean;
    };

export type WorkspaceWriteQueue<Row> = (
  params: EnqueueParams<Row>,
) => Promise<WorkspaceWriteOutcome<Row>>;

type Lane<Row> = {
  tail: Promise<void>;
  confirmed: Row | undefined;
  pending: number;
};

export const createWorkspaceWriteQueue = <Row>(): WorkspaceWriteQueue<Row> => {
  const lanes = new Map<WorkspaceId, Lane<Row>>();
  return ({ workspaceId, previous, persist }) => {
    const lane = lanes.get(workspaceId) ?? {
      tail: Promise.resolve(),
      confirmed: previous,
      pending: 0,
    };
    lanes.set(workspaceId, lane);
    lane.pending += 1;
    const run = lane.tail.then(async (): Promise<WorkspaceWriteOutcome<Row>> => {
      try {
        const stored = await persist({ confirmed: lane.confirmed });
        lane.confirmed = stored;
        lane.pending -= 1;
        return { ok: true, stored, isLast: lane.pending === 0 };
      } catch (error) {
        lane.pending -= 1;
        return { ok: false, error, confirmed: lane.confirmed, isLast: lane.pending === 0 };
      }
    });
    const tail = run.then(() => undefined);
    lane.tail = tail;
    void tail.then(() => {
      if (lanes.get(workspaceId) === lane && lane.pending === 0) {
        lanes.delete(workspaceId);
      }
    });
    return run;
  };
};
