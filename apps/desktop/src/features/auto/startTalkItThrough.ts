import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { talkItThroughGoal } from './talkItThroughGoal';

type Params = {
  readonly state: Pick<AppStore, 'openDrawer' | 'setNewDrawerAutoGoal'>;
  readonly sessionId: SessionId;
  readonly title: string;
  readonly detail: string | null;
};

export const startTalkItThrough = ({ state, sessionId, title, detail }: Params): void => {
  state.setNewDrawerAutoGoal({ sessionId, goal: talkItThroughGoal({ title, detail }) });
  state.openDrawer({ kind: 'new', sessionId, payload: { tab: 'agent' } });
};
