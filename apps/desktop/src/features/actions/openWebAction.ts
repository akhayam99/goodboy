import type { SessionId } from '@goodboy/types';
import { openLinkOrThrow } from '../open/openLinkOrThrow';
import type { ActionEnv } from './types';

type Params = {
  readonly url: string | null;
  readonly env: ActionEnv;
  readonly sessionId?: SessionId | null;
};

export const openWebAction = ({ url, env, sessionId }: Params): Promise<void> | undefined =>
  url === null
    ? undefined
    : openLinkOrThrow({
        url,
        sessionId: sessionId === undefined ? env.getState().currentSessionId : sessionId,
      });
