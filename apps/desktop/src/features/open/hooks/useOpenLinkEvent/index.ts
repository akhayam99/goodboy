import { useEffect } from 'react';
import { brandId, type SessionId } from '@goodboy/types';
import type { OpenLinkDetail } from '../../../../shared/lib/dispatchWindowEvent/windowEvents';
import { openLink } from '../../openLink';

type EventParams = {
  readonly event: Event;
};

const detailOf = ({ event }: EventParams): OpenLinkDetail | null => {
  const detail: unknown = event instanceof CustomEvent ? event.detail : null;
  if (typeof detail !== 'object' || detail === null) {
    return null;
  }
  const url = Reflect.get(detail, 'url');
  if (typeof url !== 'string') {
    return null;
  }
  const sessionId = Reflect.get(detail, 'sessionId');
  return {
    url,
    hasMetaKey: Reflect.get(detail, 'hasMetaKey') === true,
    hasCtrlKey: Reflect.get(detail, 'hasCtrlKey') === true,
    ...(sessionId === null ? { sessionId } : {}),
    ...(typeof sessionId === 'string'
      ? { sessionId: brandId<SessionId>({ value: sessionId }) }
      : {}),
    ...(Reflect.get(detail, 'place') === 'outside'
      ? ({ place: 'outside' } satisfies Pick<OpenLinkDetail, 'place'>)
      : {}),
  };
};

const onOpenLink = ({ event }: EventParams): void => {
  const detail = detailOf({ event });
  if (detail === null) {
    return;
  }
  openLink({
    url: detail.url,
    event: { metaKey: detail.hasMetaKey === true, ctrlKey: detail.hasCtrlKey === true },
    ...(detail.sessionId === undefined ? {} : { sessionId: detail.sessionId }),
    ...(detail.place === undefined ? {} : { place: detail.place }),
  });
};

export const useOpenLinkEvent = (): void => {
  useEffect(() => {
    const controller = new AbortController();
    window.addEventListener('goodboy:open-link', (event) => onOpenLink({ event }), {
      signal: controller.signal,
    });
    return () => controller.abort();
  }, []);
};
