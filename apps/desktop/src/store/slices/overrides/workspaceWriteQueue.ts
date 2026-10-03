import type { WorkspaceId } from '@goodboy/types';

type EnqueueParams<Payload> = {
  readonly workspaceId: WorkspaceId;
  readonly payload: Payload;
  readonly previous: Payload | undefined;
  readonly persist: (payload: Payload) => Promise<void>;
};

type WorkspaceWriteOutcome<Payload> =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: unknown; readonly rollback: Payload | undefined };

export type WorkspaceWriteQueue<Payload> = (
  params: EnqueueParams<Payload>,
) => Promise<WorkspaceWriteOutcome<Payload>>;

type Lane<Payload> = {
  tail: Promise<void>;
  confirmed: Payload | undefined;
};

export const createWorkspaceWriteQueue = <Payload>(): WorkspaceWriteQueue<Payload> => {
  const lanes = new Map<WorkspaceId, Lane<Payload>>();
  return ({ workspaceId, payload, previous, persist }) => {
    const lane = lanes.get(workspaceId) ?? { tail: Promise.resolve(), confirmed: previous };
    lanes.set(workspaceId, lane);
    const run = lane.tail.then(async (): Promise<WorkspaceWriteOutcome<Payload>> => {
      try {
        await persist(payload);
        lane.confirmed = payload;
        return { ok: true };
      } catch (error) {
        return { ok: false, error, rollback: lane.confirmed };
      }
    });
    const tail = run.then(() => undefined);
    lane.tail = tail;
    void tail.then(() => {
      if (lanes.get(workspaceId) === lane && lane.tail === tail) {
        lanes.delete(workspaceId);
      }
    });
    return run;
  };
};
