import type { ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { lensPlace } from '../../store/slices/navigation/canonicalLocation';
import { dispatchAfterNavigation } from '../actions/dispatchAfterNavigation';
import { projectWorktreesEventOf } from './projectWorktreesEventOf';

type Params = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
};

export const openProjectWorktrees = ({ sessionId, projectId }: Params): void => {
  const state = useAppStore.getState();
  state.navigate({ to: lensPlace({ state, sessionId, lens: null }) });
  dispatchAfterNavigation({ name: projectWorktreesEventOf({ sessionId, projectId }) });
};
