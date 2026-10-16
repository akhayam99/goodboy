import type { ChatMessage } from '@goodboy/types';
import { pluralize } from '../../../shared/utils/pluralize';
import { joinFacts } from '../../../shared/utils/joinFacts';
import { formatAskCost } from './askRightNow';

type Params = {
  readonly message: ChatMessage;
  readonly costUsd: number | null;
};

export const askReplyDetail = ({ message, costUsd }: Params): string =>
  joinFacts({
    facts: [
      costUsd === null ? null : formatAskCost(costUsd),
      message.reads.length === 0 ? null : `read ${pluralize(message.reads.length, 'file')}`,
    ],
  });
