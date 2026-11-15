import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { WorkFilter } from '../../../../store/slices/work/state';
import { useIsWorkOn } from '../../../../shared/hooks/useIsWorkOn';
import { usePoll } from '../../../../shared/lib/usePoll';
import { useRootTurns } from '../../../../shared/hooks/useRootTurns';
import { workRowsOf, type WorkRows } from '../../workRowsOf';

const POLL_MS = 15_000;

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly filter: WorkFilter;
};

export type WorkLeadsModel = WorkRows &
  Readonly<{
    isLoading: boolean;
    isStale: boolean;
    retry: () => void;
  }>;

export const useWorkLeads = ({ workspaceId, filter }: Params): WorkLeadsModel => {
  const leads = useAppStore((state) => state.workLeads);
  const loadedFor = useAppStore((state) => state.workWorkspaceId);
  const isStale = useAppStore((state) => state.isWorkStale);
  const rootTurns = useRootTurns({ leads });
  const loadWorkLeads = useAppStore((state) => state.loadWorkLeads);
  const isWork = useIsWorkOn();

  const load = (): void => void loadWorkLeads({ workspaceId, filter });
  usePoll({ run: load, everyMs: POLL_MS, restartKey: `${workspaceId}:${filter}` });

  const rows = useMemo(
    () => workRowsOf({ leads, rootTurns, filter, isWork }),
    [leads, rootTurns, filter, isWork],
  );

  return { ...rows, isLoading: loadedFor !== workspaceId, isStale, retry: load };
};
