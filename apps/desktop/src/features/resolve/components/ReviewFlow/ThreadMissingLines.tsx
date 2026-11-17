import type { SessionId } from '@goodboy/types';
import { ThreadRecheckLine } from './ThreadRecheckLine';
import { ThreadVerdictCard } from './ThreadVerdictCard';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
};

export const ThreadMissingLines = ({ sessionId, entry }: Props) => {
  if (entry.remote !== 'missing') {
    return null;
  }
  if (entry.isChecking) {
    return <ThreadRecheckLine sessionId={sessionId} agentId={entry.checkAgentId} />;
  }
  const verdict = entry.facts?.verdict ?? null;
  return (
    <>
      {verdict === null ? null : (
        <ThreadVerdictCard
          sessionId={sessionId}
          verdict={verdict}
          isPushed={entry.facts?.missing?.wasPushed === true}
        />
      )}
      {entry.checkError === null ? null : (
        <p role="status" className="text-meta text-warning">
          {entry.checkError}
        </p>
      )}
    </>
  );
};
