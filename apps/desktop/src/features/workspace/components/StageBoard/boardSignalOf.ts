import type {
  PullRequestHost,
  SessionAttentionReason,
  SessionPrFetchState,
  SessionStageInfo,
} from '@goodboy/types';
import { attentionWordsOf } from '../../../session/session-stage';
import type { LinkedRequest } from './StageBoardCard/getLinkedRequest';

export type BoardSignal =
  | {
      readonly kind: 'attention';
      readonly reason: SessionAttentionReason;
      readonly label: string;
      readonly word: string | null;
    }
  | { readonly kind: 'request'; readonly request: LinkedRequest }
  | {
      readonly kind: 'request-pending';
      readonly fetchState: 'unknown' | 'unreachable';
      readonly host: PullRequestHost;
    }
  | { readonly kind: 'running'; readonly count: number }
  | { readonly kind: 'none' };

type Params = {
  readonly info: SessionStageInfo;
  readonly request: LinkedRequest;
  readonly prFetchState: SessionPrFetchState;
  readonly requestHost?: PullRequestHost;
  readonly runningCount: number;
  readonly isArchived: boolean;
};

type InfoParams = {
  readonly info: SessionStageInfo;
};

type ReasonParams = InfoParams & {
  readonly reason: SessionAttentionReason;
};

const hasReason = ({ info, reason }: ReasonParams): boolean =>
  info.attention === reason || (info.otherReasons ?? []).includes(reason);

const hasOpenQuestion = ({ info }: InfoParams): boolean =>
  (info.openQuestionCount ?? 0) > 0 || hasReason({ info, reason: 'open-question' });

const compactWordOf = ({ info, reason }: ReasonParams): string | null => {
  if (reason === 'open-question') {
    const count = Math.max(info.openQuestionCount ?? 0, 1);
    return count > 1 ? String(count) : null;
  }
  return reason === 'ci-failed' ? 'Checks' : null;
};

const attentionSignalOf = ({ info, reason }: ReasonParams): BoardSignal => {
  const words = attentionWordsOf({ reason, counts: info });
  return { kind: 'attention', reason, label: words, word: words };
};

const compactSignalOf = ({ info, reason }: ReasonParams): BoardSignal => ({
  kind: 'attention',
  reason,
  label: attentionWordsOf({ reason, counts: info }),
  word: compactWordOf({ info, reason }),
});

export const boardSignalOf = ({
  info,
  request,
  prFetchState,
  requestHost = 'github',
  runningCount,
  isArchived,
}: Params): BoardSignal => {
  if (!isArchived && info.stage === 'attention' && info.attention !== null) {
    return attentionSignalOf({ info, reason: info.attention });
  }
  if (!isArchived && hasOpenQuestion({ info })) {
    return compactSignalOf({ info, reason: 'open-question' });
  }
  if (!isArchived && hasReason({ info, reason: 'ci-failed' })) {
    return compactSignalOf({ info, reason: 'ci-failed' });
  }
  if (request.state !== 'none') {
    return { kind: 'request', request };
  }
  const running = Math.max(runningCount, info.isRunning === true ? 1 : 0);
  if (!isArchived && running > 0) {
    return { kind: 'running', count: running };
  }
  if (!isArchived && prFetchState !== 'known') {
    return { kind: 'request-pending', fetchState: prFetchState, host: requestHost };
  }
  return { kind: 'none' };
};
