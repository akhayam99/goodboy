import { useEffect, useState } from 'react';
import { UserText } from '../../../../../features/chat/components/TranscriptCards/UserText';
import { mockSceneIpc } from '../mockSceneIpc';
import { ATTACHMENTS_SEED } from './attachmentsSeed';

const SECOND_IMAGE_LABEL = 'Preview ledger-diff.png';

export const AttachmentsViewerScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mockSceneIpc((cmd, payload) => {
      if (cmd !== 'attachment_read') {
        return undefined;
      }
      const relPath = ATTACHMENTS_SEED.relPathOfPayload({ payload });
      return relPath === null ? undefined : ATTACHMENTS_SEED.dataUriOf({ relPath });
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
        text={ATTACHMENTS_SEED.text}
        at={ATTACHMENTS_SEED.at}
        attachments={ATTACHMENTS_SEED.message}
        workingDir={ATTACHMENTS_SEED.workingDir}
      />
    </main>
  );
};
