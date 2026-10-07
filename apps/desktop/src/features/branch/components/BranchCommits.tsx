import { LensEmptyState, PageColumn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { CommitsHistory } from '../../history/components/CommitsHistory';
import { BranchBodyColumn } from './BranchBodyColumn';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
};

export const BranchCommits = ({ sessionId, worktreePath }: Props) => {
  if (worktreePath === null) {
    return (
      <PageColumn width="column">
        <LensEmptyState
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="No worktree for this session"
          description="This session has no checked-out worktree, so there are no commits to show."
        />
      </PageColumn>
    );
  }
  return (
    <BranchBodyColumn>
      <CommitsHistory sessionId={sessionId} worktreePath={worktreePath} />
    </BranchBodyColumn>
  );
};
