import type {
  MountAgent,
  MountId,
  MountPullRequestIdentity,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import type { TerminalTab } from '../../shared/types/terminal';
import type { AppState, MountGithubState } from '../../store/types';

export type TrackTerminal = TerminalTab & { readonly mountId: MountId };

export type Track = Readonly<{
  mount: SessionProjectMount;
  github: MountGithubState | null;
  selectedPr: MountPullRequestIdentity | null;
  terminals: ReadonlyArray<TrackTerminal>;
  agents: ReadonlyArray<MountAgent>;
}>;

type Params = {
  readonly state: Pick<
    AppState,
    'sessionProjectMounts' | 'mountGithub' | 'mountSelectedPr' | 'terminalTabs' | 'sessionPhaseRuns'
  >;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const trackOf = ({ state, sessionId, mountId }: Params): Track | null => {
  const mount = (state.sessionProjectMounts?.[sessionId] ?? []).find(
    (candidate) => candidate.mountId === mountId,
  );
  if (mount === undefined) {
    return null;
  }
  return {
    mount,
    github: state.mountGithub[mountId] ?? null,
    selectedPr: state.mountSelectedPr[mountId] ?? null,
    terminals: (state.terminalTabs[sessionId] ?? []).filter(
      (tab): tab is TrackTerminal => tab.mountId === mountId,
    ),
    agents: (state.sessionPhaseRuns[sessionId] ?? []).filter(
      (agent): agent is MountAgent => agent.mountId === mountId && agent.deletedAt === undefined,
    ),
  };
};
