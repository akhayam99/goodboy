import { settleItemAnswered } from './settleItemAnswered';
import type { ItemParams, SliceParams } from './types';

export const resolveWithoutReply = (params: SliceParams & ItemParams): Promise<void> =>
  settleItemAnswered({ ...params, reply: '' });
