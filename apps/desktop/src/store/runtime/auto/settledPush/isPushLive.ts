import type { ResultPublish } from '@goodboy/core/auto';
import { PUSH_LIVE_WINDOW_MS } from './PUSH_LIVE_WINDOW_MS';

export type IsPushLiveParams = Readonly<{
  record: ResultPublish;
  nowMs: number;
}>;

export const isPushLive = ({ record, nowMs }: IsPushLiveParams): boolean =>
  record.startedAt !== null && nowMs - record.startedAt < PUSH_LIVE_WINDOW_MS;
