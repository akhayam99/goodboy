import { Notice } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { StaleDepsAction } from '../../../../../shared/components/StaleDepsAction';
import { checksSkippedLine, checksSkippedOf, isMissingDepsReason } from '../../../checksSkipped';

type Props = {
  readonly text: string;
  readonly sessionId?: SessionId;
  readonly mountId?: MountId | null;
};

export const ChecksSkippedNotice = ({ text, sessionId, mountId = null }: Props) => {
  const skipped = checksSkippedOf({ text });
  if (skipped === null) {
    return null;
  }
  return (
    <Notice
      tone="warning"
      placement="banner"
      role="status"
      title={checksSkippedLine({ skipped })}
      {...(sessionId !== undefined &&
        mountId !== null && {
          actions: (
            <StaleDepsAction
              sessionId={sessionId}
              mountId={mountId}
              isForced={isMissingDepsReason({ reason: skipped.reason })}
            />
          ),
        })}
    />
  );
};
