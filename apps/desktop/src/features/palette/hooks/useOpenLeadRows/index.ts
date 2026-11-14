import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { usePoll } from '../../../../shared/lib/usePoll';
import { useRootTurns } from '../../../../shared/hooks/useRootTurns';
import { workRowsOf, type WorkRow } from '../../../work/workRowsOf';

const POLL_MS = 30_000;

const NONE: ReadonlyArray<WorkRow> = [];

type Params = {
  readonly workspaceId: WorkspaceId | null;
  readonly isEnabled: boolean;
};

export const useOpenLeadRows = ({ workspaceId, isEnabled }: Params): ReadonlyArray<WorkRow> => {
  const leads = useAppStore((state) => state.workLeads);
  const loadedFor = useAppStore((state) => state.workWorkspaceId);
  const rootTurns = useRootTurns({ leads });
  const loadWorkLeads = useAppStore((state) => state.loadWorkLeads);
  const isOn = isEnabled && workspaceId !== null;

  usePoll({
    run: () => {
      if (workspaceId === null) {
        return;
      }
      void loadWorkLeads({ workspaceId, filter: useAppStore.getState().workFilter });
    },
    everyMs: POLL_MS,
    isEnabled: isOn,
    restartKey: workspaceId ?? '',
  });

  return useMemo(
    () =>
      isOn && loadedFor === workspaceId
        ? workRowsOf({ leads, rootTurns, filter: 'open', isWork: true }).rows
        : NONE,
    [isOn, loadedFor, workspaceId, leads, rootTurns],
  );
};
