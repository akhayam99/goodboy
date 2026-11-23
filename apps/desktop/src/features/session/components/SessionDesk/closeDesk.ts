import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { OpenDrawer } from '../../../../store/slices/drawer/state';
import { focusDeskControl } from './focusDeskControl';
import { deskLines } from './useDeskOwner/deskLines';

type Params = {
  readonly sessionId: SessionId;
  readonly tools: ReadonlyArray<OpenDrawer>;
};

export const closeDesk = ({ sessionId, tools }: Params): void => {
  deskLines.keep({ sessionId, tools });
  useAppStore.getState().setSessionFace({ sessionId, face: 'overview' });
  deskLines.show({ sessionId, line: 'closed' });
  focusDeskControl({ target: 'tab' });
};
