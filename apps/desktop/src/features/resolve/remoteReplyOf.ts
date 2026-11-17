import type { ThreadGitFacts } from '../../store/slices/resolve/threadGitState';
import { verdictReply } from './commentVerdict';

type Params = {
  readonly gitFacts: ThreadGitFacts | null;
  readonly draftReply: string | null;
};

export const remoteReplyOf = ({ gitFacts, draftReply }: Params): string | null => {
  if (draftReply !== null && draftReply.trim() !== '') {
    return draftReply;
  }
  const verdict = gitFacts?.verdict ?? null;
  return verdict === null || verdict.kind === 'refix' ? null : verdictReply({ verdict });
};
