import { useCallback, useMemo } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useRootTurns } from '../../../../../shared/hooks/useRootTurns';
import { usePoll } from '../../../../../shared/lib/usePoll';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import type { WorkLead } from '../../../../../store/slices/work/state';
import { workRowsOf } from '../../../workRowsOf';
import { leadCandidatesOf, type LeadChoice, type LeadItem } from '../../leadCandidatesOf';

type Params = {
  readonly sessionId: SessionId;
  readonly item: LeadItem;
};

export type LeadChoiceHandle = Readonly<{
  choice: LeadChoice;
  reload: () => Promise<LeadChoice>;
}>;

const POLL_MS = 30_000;

const NONE: LeadChoice = { kind: 'none' };

type ChoiceParams = {
  readonly leads: ReadonlyArray<WorkLead>;
  readonly rootTurns: ReturnType<typeof useRootTurns>;
  readonly item: LeadItem;
  readonly isLoaded: boolean;
};

const leadChoiceOf = ({ leads, rootTurns, item, isLoaded }: ChoiceParams): LeadChoice =>
  isLoaded
    ? leadCandidatesOf({ rows: workRowsOf({ leads, rootTurns, filter: 'open' }).rows, item })
    : NONE;

export const useLeadChoice = ({ sessionId, item }: Params): LeadChoiceHandle => {
  const workspaceId = useAppStore(
    (state): WorkspaceId | null => sessionById(state.sessions, sessionId)?.workspaceId ?? null,
  );
  const leads = useAppStore((state) => state.workLeads);
  const loadedFor = useAppStore((state) => state.workWorkspaceId);
  const rootTurns = useRootTurns({ leads });
  const isLoaded = workspaceId !== null && loadedFor === workspaceId;
  usePoll({
    run: () => {
      if (workspaceId !== null) {
        void useAppStore.getState().loadWorkLeads({ workspaceId });
      }
    },
    everyMs: POLL_MS,
    isEnabled: workspaceId !== null,
    restartKey: workspaceId ?? '',
  });
  const choice = useMemo(
    () => leadChoiceOf({ leads, rootTurns, item, isLoaded }),
    [leads, rootTurns, item, isLoaded],
  );
  const reload = useCallback(async (): Promise<LeadChoice> => {
    if (workspaceId === null) {
      return NONE;
    }
    await useAppStore.getState().loadWorkLeads({ workspaceId });
    const latest = useAppStore.getState();
    return leadChoiceOf({
      leads: latest.workLeads,
      rootTurns,
      item,
      isLoaded: latest.workWorkspaceId === workspaceId,
    });
  }, [workspaceId, rootTurns, item]);
  return { choice, reload };
};
