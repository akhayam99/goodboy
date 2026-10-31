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

const FRAME_WIDTH = 680;

export const AttachmentsScene = () => {
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

  if (!isReady) {
    return null;
  }
  return (
    <div data-shot style={{ width: FRAME_WIDTH }}>
      <div className="flex flex-col bg-background p-6 text-foreground">
        <UserText
          text={ATTACHMENTS_TEXT}
          at={ATTACHMENTS_AT}
          attachments={ATTACHMENTS_MESSAGE}
          workingDir={ATTACHMENTS_WORKING_DIR}
        />
      </div>
    </div>
  );
};
