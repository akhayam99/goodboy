import type { SessionId } from '@goodboy/types';
import type { LinksOpen } from '../../shared/lib/linksOpenSetting';
import { ownBrowserClickWord } from './ownBrowserClickWord';
import { webLinkPlace } from './webLinkPlace';

type Params = {
  readonly sessionId: SessionId | null;
  readonly mode: LinksOpen;
  readonly hasTab: boolean;
};

export const webLinkPeekWords = ({ sessionId, mode, hasTab }: Params): string => {
  const place = webLinkPlace({ sessionId, mode, isOwnClick: false });
  if (place === 'your-browser') {
    return sessionId === null && mode === 'goodboy'
      ? 'Opens your browser, since no session is here to open it beside.'
      : 'Opens your browser.';
  }
  const lead = hasTab ? 'Shows its tab beside the session.' : 'Opens beside the session.';
  return `${lead} ${ownBrowserClickWord()} opens your browser.`;
};
