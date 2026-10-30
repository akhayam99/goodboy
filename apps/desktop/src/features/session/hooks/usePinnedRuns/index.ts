import { useMemo } from 'react';
import {
  brandId,
  type MountId,
  type ProjectId,
  type SessionId,
  type WorkflowRunId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { pinnedRunsOf } from '../../../../store/slices/workflows/runMount/pinnedRunsOf';

type Params = Readonly<{
  sessionId: SessionId;
  projectId: ProjectId;
}>;

export type PinnedRunsView = Readonly<{
  sessionId: SessionId;
  runIds: ReadonlyArray<WorkflowRunId>;
  firstLabel: string | null;
}>;

const ID_SEPARATOR = ',';

type KeyParams = Readonly<{
  key: string;
}>;

const idsOf = ({ key }: KeyParams): ReadonlyArray<string> =>
  key === '' ? [] : key.split(ID_SEPARATOR);

export const usePinnedRuns = ({ sessionId, projectId }: Params): PinnedRunsView => {
  const mountsKey = useAppStore((state) =>
    (state.sessionMounts?.[sessionId] ?? [])
      .filter((view) => view.projectId === projectId)
      .map((view) => view.id)
      .join(ID_SEPARATOR),
  );
  const idsKey = useAppStore((state) =>
    [
      ...new Set(
        idsOf({ key: mountsKey }).flatMap((value) =>
          pinnedRunsOf({ state, sessionId, mountId: brandId<MountId>({ value }) }).map(
            (pinned) => pinned.runId,
          ),
        ),
      ),
    ].join(ID_SEPARATOR),
  );
  const firstLabel = useAppStore((state) => {
    for (const value of idsOf({ key: mountsKey })) {
      const [first] = pinnedRunsOf({ state, sessionId, mountId: brandId<MountId>({ value }) });
      if (first !== undefined) {
        return first.label;
      }
    }
    return null;
  });
  return useMemo(
    () => ({
      sessionId,
      runIds: idsOf({ key: idsKey }).map((value) => brandId<WorkflowRunId>({ value })),
      firstLabel,
    }),
    [sessionId, idsKey, firstLabel],
  );
};
