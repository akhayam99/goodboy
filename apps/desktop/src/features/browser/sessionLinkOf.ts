import type { SessionId } from '@goodboy/types';
import { sessionOfElement } from './sessionOfElement';

type Params = {
  readonly target: EventTarget | null;
};

export type SessionLink = {
  readonly anchor: HTMLAnchorElement;
  readonly url: string;
  readonly sessionId: SessionId;
};

const WEB_PREFIXES = ['http://', 'https://'];

export const sessionLinkOf = ({ target }: Params): SessionLink | null => {
  if (!(target instanceof Element)) {
    return null;
  }
  const anchor = target.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) {
    return null;
  }
  const url = anchor.getAttribute('href') ?? '';
  const lower = url.toLowerCase();
  if (!WEB_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return null;
  }
  const sessionId = sessionOfElement({ element: anchor });
  return sessionId === null ? null : { anchor, url, sessionId };
};
