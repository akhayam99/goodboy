import { useEffect } from 'react';
import { brandId, type SessionId } from '@goodboy/types';
import { requestRename } from '../../../../../shared/utils/renameRequest';
import {
  SESSION_HEADER_ANCHOR,
  sessionObjectKey,
} from '../../../../../features/actions/kinds/session';
import { MountsScene } from '../MountsScene';

const OPEN_SESSION = brandId<SessionId>({ value: 'mock-session-mount-rows' });
const RETRY_MS = 100;
const RETRY_LIMIT = 50;

type Props = {
  readonly target: 'title' | 'title-linked';
};

export const R4TitleEditScene = ({ target }: Props) => {
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const isOpen = requestRename({
        objectKey: sessionObjectKey({ sessionId: OPEN_SESSION }),
        anchorKey: SESSION_HEADER_ANCHOR,
      });
      if (isOpen || tries >= RETRY_LIMIT) {
        window.clearInterval(timer);
      }
    }, RETRY_MS);
    return () => window.clearInterval(timer);
  }, [target]);

  return <MountsScene variant={target === 'title-linked' ? 'linked-title' : 'mounts'} />;
};
