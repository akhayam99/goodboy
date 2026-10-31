import { useEffect, useState } from 'react';
import { UserText } from '../../../../../features/chat/components/TranscriptCards/UserText';
import { mockSceneIpc } from '../mockSceneIpc';
import {
  ATTACHMENTS_AT,
  ATTACHMENTS_MESSAGE,
  ATTACHMENTS_TEXT,
  ATTACHMENTS_WORKING_DIR,
  attachmentDataUriOf,
  relPathOfPayload,
} from './attachmentsSeed';

const SECOND_IMAGE_LABEL = 'Preview ledger-diff.png';

export const AttachmentsViewerScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mockSceneIpc((cmd, payload) => {
      if (cmd !== 'attachment_read') {
        return undefined;
      }
      const relPath = relPathOfPayload({ payload });
      return relPath === null ? undefined : attachmentDataUriOf({ relPath });
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = setTimeout(() => {
      document.querySelector<HTMLButtonElement>(`[aria-label="${SECOND_IMAGE_LABEL}"]`)?.click();
    }, 0);
    return () => clearTimeout(timer);
  }, [isReady]);

  if (!isReady) {
    return null;
  }
  return (
    <main className="h-screen bg-background p-6 text-foreground">
      <UserText
        text={ATTACHMENTS_TEXT}
        at={ATTACHMENTS_AT}
        attachments={ATTACHMENTS_MESSAGE}
        workingDir={ATTACHMENTS_WORKING_DIR}
      />
    </main>
  );
};
