import type { SessionId } from '@goodboy/types';
import { isBranchlessSession } from '../../shared/utils/isBranchlessSession';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import type { LensKind, useAppStore } from '../../store';
import { lensDestinations } from './lens-destinations';

type State = ReturnType<typeof useAppStore.getState>;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly lens: LensKind | null;
};

export const isLensReachable = ({ state, sessionId, lens }: Params): boolean => {
  const workspaceId = sessionById(state.sessions, sessionId)?.workspaceId ?? null;
  const bindings = workspaceId === null ? [] : (state.workspaceIntegrations[workspaceId] ?? []);
  const isBound = (provider: string): boolean =>
    bindings.some((binding) => binding.provider === provider);
  return lensDestinations({
    isBranchless: isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
    connectedTools: {
      linear: isBound('linear'),
      gitlab: isBound('gitlab'),
      jira: isBound('jira'),
      slack: isBound('slack'),
    },
  }).some((destination) => destination.lens === lens);
};
