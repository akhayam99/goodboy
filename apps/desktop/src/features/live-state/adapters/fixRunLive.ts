import type { IsoDateTime } from '@goodboy/types';
import type { ResolveWord } from '../../resolve/commentProjection';
import { TAIL_ACTION } from '../tailAction';
import type { TailFacts } from '../tailFacts';

export type FixRunLiveParams = Readonly<{
  word: ResolveWord;
  laneLine: string | null;
  startedAt: IsoDateTime | null;
}>;

export const fixRunLive = ({ word, laneLine, startedAt }: FixRunLiveParams): TailFacts | null => {
  if (word === 'working') {
    return {
      state: 'working',
      phrase: laneLine ?? 'Fixing the comments',
      startedAt,
      actions: [TAIL_ACTION.stopAgent, TAIL_ACTION.viewTranscript],
    };
  }
  if (word === 'question') {
    return {
      state: 'waiting',
      phrase: 'Waiting for your answer',
      startedAt,
      actions: [TAIL_ACTION.answer],
    };
  }
  if (word === 'push_failed') {
    return {
      state: 'failed',
      phrase: 'Failed: the push was refused',
      startedAt: null,
      actions: [TAIL_ACTION.retry, TAIL_ACTION.viewTranscript],
    };
  }
  return null;
};
