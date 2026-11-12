import type { SessionId } from '@goodboy/types';
import { openBeside } from './openBeside';
import { openInYourBrowser } from './openInYourBrowser';

type Params = {
  readonly sessionId: SessionId | null;
  readonly url: string;
};

export const openInBrowser = async ({ sessionId, url }: Params): Promise<void> => {
  if (sessionId === null) {
    await openInYourBrowser({ url });
    return;
  }
  await openBeside({ sessionId, target: { kind: 'web', url } });
};
