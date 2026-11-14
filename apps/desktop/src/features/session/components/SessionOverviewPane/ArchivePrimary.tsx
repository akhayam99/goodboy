import { useMemo } from 'react';
import { Button } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../store';
import { useMountRows } from '../../../../shared/hooks/useMountRows';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { isArchivePrimaryOf } from '../../central/board/isArchivePrimaryOf';
import { useSessionArchive } from '../../hooks/useSessionArchive';

type Props = {
  readonly session: Session;
};

const ARCHIVE_KEY = 'archive';

const LIVE_STATUSES: ReadonlyArray<string> = ['running', 'pending', 'blocked'];

export const ArchivePrimary = ({ session }: Props) => {
  const sessionId = session.id;
  const groups = useMountRows({ sessionId });
  const questions = useSessionOpenQuestions(sessionId);
  const hasLiveAgent = useAppStore((state) =>
    (state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).some((agent) =>
      LIVE_STATUSES.includes(agent.status),
    ),
  );
  const { archive } = useSessionArchive();
  const pending = usePendingAction({ sessionId });
  const rows = useMemo(
    () => groups.flatMap((group) => [...group.rows, ...group.finishedRows]),
    [groups],
  );
  const isPrimary = isArchivePrimaryOf({
    branchCount: rows.length,
    mergedCount: rows.filter((row) => row.isFinished).length,
    openQuestionCount: questions.length,
    hasLiveAgent,
    isArchived: session.archivedAt != null,
  });
  if (!isPrimary) {
    return null;
  }
  return (
    <Button
      variant="primary"
      size="sm"
      isBusy={pending.pendingKeys.has(ARCHIVE_KEY)}
      onClick={() =>
        void pending.run({
          key: ARCHIVE_KEY,
          failureTitle: "Couldn't archive the session",
          task: async () => {
            const { failed } = await archive({ sessions: [session] });
            if (failed.length > 0) {
              throw new Error('The session stays where it was.');
            }
          },
        })
      }
    >
      Archive session
    </Button>
  );
};
