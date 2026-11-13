import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../store';
import { OPEN_FAILED } from '../../store/slices/notifications/errorRecovery';
import { isOwnBrowserClick } from '../browser/isOwnBrowserClick';
import { openFileLink } from '../explore/openFileLink';
import { nameOfTarget } from './nameOfTarget';
import { openBesideSession } from './openBesideSession';
import { openOutside } from './openOutside';
import { openPlaceOf } from './openPlaceOf';
import { readLinksOpen } from './readLinksOpen';
import type { OpenClick, OpenPlace, OpenResult, OpenTarget } from './types';

type Params = {
  readonly target: OpenTarget;
  readonly sessionId: SessionId | null;
  readonly event: OpenClick;
  readonly shouldReport?: boolean;
};

type GoParams = {
  readonly target: OpenTarget;
  readonly sessionId: SessionId | null;
  readonly place: OpenPlace;
};

const go = async ({ target, sessionId, place }: GoParams): Promise<void> => {
  if (target.kind === 'file') {
    await openFileLink({
      sessionId,
      root: target.root,
      baseDir: target.root,
      link: { path: target.path, line: target.line, column: null },
    });
    return;
  }
  if (place === 'beside-session' && sessionId !== null) {
    await openBesideSession({ sessionId, target });
    return;
  }
  await openOutside({ target });
};

export const openTarget = async ({
  target,
  sessionId,
  event,
  shouldReport = true,
}: Params): Promise<OpenResult> => {
  const isOwnClick = isOwnBrowserClick({ event });
  const mode = await readLinksOpen();
  const place = openPlaceOf({ target, mode, isOwnClick, sessionId });
  try {
    await go({ target, sessionId, place });
    return { status: 'opened', place };
  } catch (error) {
    if (shouldReport) {
      await useAppStore.getState().reportError({
        recovery: OPEN_FAILED,
        title: `Couldn't open ${nameOfTarget({ target })}`,
        error,
        ...(sessionId === null ? {} : { sessionId }),
      });
    }
    return { status: 'failed', reason: formatError(error) };
  }
};
