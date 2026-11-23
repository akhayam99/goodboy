import type { SessionId } from '@goodboy/types';
import { currentWindowLabel } from '../../../../workspace/window';
import { deskLines } from './deskLines';

type Params = {
  readonly sessionId: SessionId;
};

export const isDeskElsewhere = ({ sessionId }: Params): boolean => {
  const holder = deskLines.holderOf({ sessionId });
  return holder !== null && holder !== currentWindowLabel();
};
