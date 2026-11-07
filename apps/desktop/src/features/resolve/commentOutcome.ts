import type { OpenQuestion, ResolveQueueItem, ResolveThread, ResolveVerdict } from '@goodboy/types';
import { resolveProposalKind } from '../../store/slices/resolve/resolveProposalKind';
import { verdictReply } from './commentVerdict';
import { threadFixSha } from './threadFixSha';

export type CommentOutcome =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'working' }
  | { readonly kind: 'fix-proposed' }
  | { readonly kind: 'fixed'; readonly sha: string }
  | { readonly kind: 'question'; readonly text: string }
  | { readonly kind: 'no-change'; readonly reply: string }
  | { readonly kind: 'failed'; readonly sentence: string };

export type CommentOutcomeKind = CommentOutcome['kind'];

type Params = {
  readonly thread: ResolveThread;
  readonly item: ResolveQueueItem;
  readonly question: Pick<OpenQuestion, 'text'> | null;
  readonly verdict?: ResolveVerdict | null;
  readonly failure?: string | null;
};

const SHORT_SHA_LENGTH = 7;
const FAILED_FALLBACK = 'The fix did not finish';

type VerdictParams = {
  readonly verdict: ResolveVerdict | null;
};

const isClosingVerdict = ({ verdict }: VerdictParams): boolean =>
  verdict !== null && (verdict.kind === 'obsolete' || verdict.kind === 'fixed_elsewhere');

export const commentOutcomeOf = ({
  thread,
  item,
  question,
  verdict = null,
  failure = null,
}: Params): CommentOutcome | null => {
  if (thread.stage === 'resolved' || thread.stage === 'parked') {
    return null;
  }
  if (item.integratedSha !== null) {
    return { kind: 'fixed', sha: item.integratedSha.slice(0, SHORT_SHA_LENGTH) };
  }
  switch (thread.stage) {
    case 'new':
      return { kind: 'waiting' };
    case 'working':
    case 'publishing':
      return { kind: 'working' };
    case 'failed':
      return { kind: 'failed', sentence: failure ?? FAILED_FALLBACK };
    case 'asking':
      return question === null ? { kind: 'working' } : { kind: 'question', text: question.text };
    case 'approved': {
      const sha = threadFixSha({ commitShas: thread.commitShas });
      return sha === null
        ? { kind: 'working' }
        : { kind: 'fixed', sha: sha.slice(0, SHORT_SHA_LENGTH) };
    }
    case 'proposed': {
      if (isClosingVerdict({ verdict }) && verdict !== null) {
        return { kind: 'no-change', reply: verdictReply({ verdict }) };
      }
      const kind = resolveProposalKind({ item, thread });
      if (kind === 'fix' || thread.disposition === 'fix') {
        return { kind: 'fix-proposed' };
      }
      return { kind: 'no-change', reply: thread.replyDraft ?? '' };
    }
    default: {
      const exhaustive: never = thread.stage;
      return exhaustive;
    }
  }
};
