import type { SessionPrFetchState, SessionStageInfo } from '@goodboy/types';
import type { LinkedRequest } from './StageBoardCard/getLinkedRequest';

export type BoardSignal =
  | { readonly kind: 'question'; readonly count: number }
  | { readonly kind: 'checks-failed' }
  | { readonly kind: 'request'; readonly request: LinkedRequest }
  | { readonly kind: 'request-pending'; readonly fetchState: 'unknown' | 'unreachable' }
  | { readonly kind: 'running'; readonly count: number }
  | { readonly kind: 'none' };

type Params = {
  readonly info: SessionStageInfo;
  readonly request: LinkedRequest;
  readonly prFetchState: SessionPrFetchState;
  readonly runningCount: number;
  readonly isArchived: boolean;
};

type ChecksParams = {
  readonly info: SessionStageInfo;
};

const hasFailedChecks = ({ info }: ChecksParams): boolean =>
  info.attention === 'ci-failed' || (info.otherReasons ?? []).includes('ci-failed');

export const boardSignalOf = ({
  info,
  request,
  prFetchState,
  runningCount,
  isArchived,
}: Params): BoardSignal => {
  const questions = info.openQuestionCount ?? 0;
  if (!isArchived && (questions > 0 || info.attention === 'open-question')) {
    return { kind: 'question', count: Math.max(questions, 1) };
  }
  if (!isArchived && hasFailedChecks({ info })) {
    return { kind: 'checks-failed' };
  }
  if (request.state !== 'none') {
    return { kind: 'request', request };
  }
  const running = Math.max(runningCount, info.isRunning === true ? 1 : 0);
  if (!isArchived && running > 0) {
    return { kind: 'running', count: running };
  }
  if (!isArchived && prFetchState !== 'known') {
    return { kind: 'request-pending', fetchState: prFetchState };
  }
  return { kind: 'none' };
};
