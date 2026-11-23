import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { sessionPlace } from '../../store/slices/navigation/place';
import type { BranchTab, Place } from '../../store/slices/navigation/types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: string;
  readonly tab: BranchTab;
};

export const branchTabPlaceOf = ({ sessionId, mountId, tab }: Params): Place =>
  sessionPlace({
    sessionId,
    lens: 'branch',
    target: {
      kind: 'branch',
      mountId: brandId<MountId>({ value: mountId }),
      mountPath: null,
      tab,
      threadId: null,
      focus: null,
    },
  });
