import { brandId, type MountId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { GetFn } from '../../../slice-types';
import type { AttachMountOutcome, AttachMountParams } from '../ports';

type Params = {
  readonly get: GetFn;
  readonly params: AttachMountParams;
};

export const attachAutoMount = async ({ get, params }: Params): Promise<AttachMountOutcome> => {
  const { sessionId, mountId } = params;
  try {
    await get().attachMount({ sessionId, mountId: brandId<MountId>({ value: mountId }) });
    return { kind: 'attached' };
  } catch (error) {
    return { kind: 'failed', error: formatError(error) };
  }
};
