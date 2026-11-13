import type { SessionId } from '@goodboy/types';
import type { LinksOpen } from '../../shared/lib/linksOpenSetting';

export type WebLinkPlace = 'beside-session' | 'your-browser';

type Params = {
  readonly sessionId: SessionId | null;
  readonly mode: LinksOpen;
  readonly isOwnClick: boolean;
};

export const webLinkPlace = ({ sessionId, mode, isOwnClick }: Params): WebLinkPlace =>
  isOwnClick || mode === 'browser' || sessionId === null ? 'your-browser' : 'beside-session';
