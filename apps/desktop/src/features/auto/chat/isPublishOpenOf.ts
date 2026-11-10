import { canPutBackPublish, canRetryPublish, type ResultPublish } from '@goodboy/core/auto';
import type { PublishAct } from '../publishPort';

type Params = {
  readonly act: PublishAct;
  readonly publish: ResultPublish | null;
};

type OpenParams = {
  readonly publish: ResultPublish;
};

const OPEN_BY_ACT: Readonly<Record<PublishAct, (params: OpenParams) => boolean>> = {
  confirm: ({ publish }) => publish.state === 'awaiting_confirm',
  decline: ({ publish }) => publish.state === 'awaiting_confirm',
  retry: canRetryPublish,
  put_back: canPutBackPublish,
};

export const isPublishOpenOf = ({ act, publish }: Params): boolean =>
  publish !== null && OPEN_BY_ACT[act]({ publish });
