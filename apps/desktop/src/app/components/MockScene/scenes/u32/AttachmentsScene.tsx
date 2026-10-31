import { useEffect, useState } from 'react';
import { UserText } from '../../../../../features/chat/components/TranscriptCards/UserText';
import { mockSceneIpc } from '../mockSceneIpc';
import { ATTACHMENTS_SEED } from './attachmentsSeed';

const FRAME_WIDTH = 680;

export const AttachmentsScene = () => {
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

  if (!isReady) {
    return null;
  }
  return (
    <div data-shot style={{ width: FRAME_WIDTH }}>
      <div className="flex flex-col bg-background p-6 text-foreground">
        <UserText
          text={ATTACHMENTS_SEED.text}
          at={ATTACHMENTS_SEED.at}
          attachments={ATTACHMENTS_SEED.message}
          workingDir={ATTACHMENTS_SEED.workingDir}
        />
      </div>
    </div>
  );
};
