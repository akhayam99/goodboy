import { settleItemAnswered } from './settleItemAnswered';
import type { ItemParams, SliceParams } from './types';

export { RESOLVE_ONLY_AFTER_INTEGRATION, RESOLVE_ONLY_REASON } from './settleItemAnswered';

export const resolveWithoutReply = (params: SliceParams & ItemParams): Promise<void> =>
  settleItemAnswered({ ...params, reply: '' });
