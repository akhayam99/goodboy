import type { SessionId } from '@goodboy/types';
import { selectGridTool } from '../drawer/selectGridTool';

type Params = {
  readonly state: Parameters<typeof selectGridTool>[0]['state'];
  readonly sessionId: SessionId;
};

export const selectIsAskOpen = ({ state, sessionId }: Params): boolean =>
  selectGridTool({ state, kind: 'ask' })?.sessionId === sessionId;
