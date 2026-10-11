import type { MountId } from '@goodboy/types';
import { scribeKeyOf } from '../../store/slices/scribe/scribeKeyOf';
import type { ScribeWork } from '../../store/slices/scribe/types';
import type { ScribeRequestState } from './types';

type Params = {
  readonly scribeWork: Readonly<Record<string, ScribeWork>>;
  readonly mountId: MountId;
};

export const scribeRequestStateOf = ({
  scribeWork,
  mountId,
}: Params): ScribeRequestState | null => {
  const status = scribeWork[scribeKeyOf({ mountId, kind: 'pr' })]?.status;
  if (status === 'writing' || status === 'ready' || status === 'creating') {
    return status;
  }
  return null;
};
