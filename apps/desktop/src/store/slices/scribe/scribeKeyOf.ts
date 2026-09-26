import type { MountId } from '@goodboy/types';
import type { ScribeTask } from './types';

type Params = {
  readonly mountId: MountId;
  readonly kind: ScribeTask['kind'];
};

export const scribeKeyOf = ({ mountId, kind }: Params): string => `${kind}:${mountId}`;
