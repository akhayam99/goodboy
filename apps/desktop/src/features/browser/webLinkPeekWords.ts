import type { SessionId } from '@goodboy/types';
import type { LinksOpen } from '../../shared/lib/linksOpenSetting';
import { openPlaceOf } from '../open/openPlaceOf';
import type { OpenTarget } from '../open/types';
import { ownBrowserClickWord } from './ownBrowserClickWord';

const PEEKED_LINK = { kind: 'web', url: '' } as const satisfies OpenTarget;

type Params = {
  readonly sessionId: SessionId | null;
  readonly mode: LinksOpen;
  readonly hasTab: boolean;
};

export const webLinkPeekWords = ({ sessionId, mode, hasTab }: Params): string => {
  const place = openPlaceOf({ target: PEEKED_LINK, mode, isOwnClick: false, sessionId });
  if (place === 'your-browser') {
    return sessionId === null && mode === 'goodboy'
      ? 'Opens your browser, since no session is here to open it beside.'
      : 'Opens your browser.';
  }
  const lead = hasTab ? 'Shows its tab beside the session.' : 'Opens beside the session.';
  return `${lead} ${ownBrowserClickWord()} opens your browser.`;
};
