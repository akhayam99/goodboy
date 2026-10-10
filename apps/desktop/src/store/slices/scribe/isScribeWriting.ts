import type { MountId } from '@goodboy/types';
import { scribeKeyOf } from './scribeKeyOf';
import type { ScribeWork } from './types';

type Params = {
  readonly scribeWork: Readonly<Record<string, ScribeWork>>;
  readonly mountId: MountId;
};

export const isScribeWriting = ({ scribeWork, mountId }: Params): boolean => {
  const status = scribeWork?.[scribeKeyOf({ mountId, kind: 'pr' })]?.status;
  return status === 'writing' || status === 'creating';
};
