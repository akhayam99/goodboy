import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { READ_FAILED } from '../../store/slices/notifications/errorRecovery';
import { linksOpenOf } from '../../shared/lib/linksOpenOf';
import { SETTING_LINKS_OPEN } from '../../shared/lib/linksOpenSetting';
import { isOwnBrowserClick } from './isOwnBrowserClick';
import { openInBrowser } from './openInBrowser';
import { openInYourBrowser } from './openInYourBrowser';
import { webLinkPlace } from './webLinkPlace';

type Params = {
  readonly sessionId: SessionId | null;
  readonly url: string;
  readonly event: Pick<MouseEvent, 'metaKey' | 'ctrlKey'>;
};

const readLinksOpen = async (): Promise<string | null> => {
  const state = useAppStore.getState();
  const saved = state.settings[SETTING_LINKS_OPEN];
  if (saved !== undefined) {
    return saved;
  }
  try {
    return await state.loadSetting(SETTING_LINKS_OPEN);
  } catch (error) {
    void state.reportError({
      title: "Couldn't read where links open",
      error,
      recovery: READ_FAILED,
      severity: 'warning',
    });
    return null;
  }
};

export const openWebLink = async ({ sessionId, url, event }: Params): Promise<void> => {
  const isOwnClick = isOwnBrowserClick({ event });
  const raw = await readLinksOpen();
  const place = webLinkPlace({ sessionId, mode: linksOpenOf({ raw }), isOwnClick });
  if (place === 'your-browser') {
    await openInYourBrowser({ url });
    return;
  }
  await openInBrowser({ sessionId, url });
};
