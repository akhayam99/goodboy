import type { SessionId } from '@goodboy/types';
import { openStartRun } from '../session/startRun/openStartRun';
import { talkItThroughGoal } from './talkItThroughGoal';

type Params = {
  readonly sessionId: SessionId;
  readonly title: string;
  readonly detail: string | null;
};

export const startTalkItThrough = ({ sessionId, title, detail }: Params): void => {
  openStartRun({ sessionId, text: talkItThroughGoal({ title, detail }) });
};
