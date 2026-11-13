import type { SessionId } from '@goodboy/types';
import { openTarget } from '../open/openTarget';
import type { OpenClick } from '../open/types';

type Params = {
  readonly sessionId: SessionId | null;
  readonly url: string;
  readonly event: OpenClick;
};

export const openWebLink = async ({ sessionId, url, event }: Params): Promise<void> => {
  await openTarget({ target: { kind: 'web', url }, sessionId, event });
};
