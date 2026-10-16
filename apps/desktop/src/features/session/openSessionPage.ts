import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { openAutoAgents } from '../auto/openAutoAgents';
import { openLens } from './openLens';
import type { Page } from './pageRegistry';

type Params = {
  readonly sessionId: SessionId;
  readonly page: Page;
};

export const openSessionPage = ({ sessionId, page }: Params): void => {
  const open =
    page.id === 'auto'
      ? () => openAutoAgents({ sessionId })
      : () => openLens({ sessionId, lens: page.lens });
  open();
  const state = useAppStore.getState();
  state.setFocusedArtifactId(sessionId, null);
  state.setFocusedWorkflowRun(sessionId, null);
};
