import type { AdmissionSnapshot } from '@goodboy/core/auto';

export type AdmissionStateParams = Readonly<{
  snapshot: Pick<AdmissionSnapshot, 'level'>;
  isConfirmForced: boolean;
}>;

export const admissionStateOf = ({
  snapshot,
  isConfirmForced,
}: AdmissionStateParams): 'accepted' | 'awaiting_confirm' =>
  snapshot.level === 'step' || isConfirmForced ? 'awaiting_confirm' : 'accepted';
