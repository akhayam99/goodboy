import type { ShowToast } from '../../shared/components/Toast';
import { formatDateTime } from '../../shared/utils/time/formatDateTime';
import { LAST_CRASH_TITLE, claimLastCrash, deleteLastCrash, type LastCrash } from './lastCrash';
import { openReportSheet } from './openReportSheet';

type MessageParams = {
  readonly crash: LastCrash;
};

type OfferParams = {
  readonly showToast: ShowToast;
  readonly isActive: () => boolean;
};

const crashMessage = ({ crash }: MessageParams): string => {
  const when = formatDateTime({ at: new Date(crash.occurredAt).toISOString(), hasYear: true });
  const where = crash.screen == null ? '' : `, on ${crash.screen}`;
  return `${when}${where}. The error is saved on this computer until you report or dismiss it.`;
};

export const offerLastCrash = async ({ showToast, isActive }: OfferParams): Promise<void> => {
  const crash = await claimLastCrash();
  if (!isActive() || crash == null) {
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
};
