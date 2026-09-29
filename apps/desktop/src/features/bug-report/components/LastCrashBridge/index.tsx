import { useEffect } from 'react';
import { useToast } from '../../../../app/components/Toast';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { LAST_CRASH_TITLE, claimLastCrash, deleteLastCrash, type LastCrash } from '../../lastCrash';
import { openReportSheet } from '../../openReportSheet';

type MessageParams = {
  readonly crash: LastCrash;
};

const crashMessage = ({ crash }: MessageParams): string => {
  const when = formatDateTime({ at: new Date(crash.occurredAt).toISOString(), hasYear: true });
  const where = crash.screen == null ? '' : `, on ${crash.screen}`;
  return `${when}${where}. The error is saved on this computer until you report or dismiss it.`;
};

export const LastCrashBridge = () => {
  const { showToast } = useToast();

  useEffect(() => {
    let isActive = true;
    void claimLastCrash().then((crash) => {
      if (!isActive || crash == null) {
        return;
      }
      showToast({
        kind: 'warning',
        title: LAST_CRASH_TITLE[crash.kind],
        message: crashMessage({ crash }),
        persist: true,
        action: { label: 'Report it', onClick: () => openReportSheet({ crash }) },
        onDismiss: () => void deleteLastCrash(),
      });
    });
    return () => {
      isActive = false;
    };
  }, [showToast]);

  return null;
};
