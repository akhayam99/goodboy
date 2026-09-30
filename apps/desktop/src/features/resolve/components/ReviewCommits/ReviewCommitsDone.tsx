import { Undo2 } from 'lucide-react';
import { Button, Chip, Notice } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { REVIEW_COMMITS_LABEL, backupLine, commitCountLabel } from '../../reviewCommitsCopy';
import type { ReviewCommitsModel } from './useReviewCommits';

type Props = {
  readonly model: ReviewCommitsModel;
};

export const ReviewCommitsDone = ({ model }: Props) => {
  const run = model.run;
  if (run === null || run.backupRef === null) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <Notice
        tone="success"
        placement="inline"
        role="status"
        title="Branch rewritten."
        body={<span className="text-code">{backupLine({ backupRef: run.backupRef })}</span>}
        actions={
          <Button variant="ghost" size="sm" onClick={() => void model.undo()}>
            <Undo2 size={ICON_SIZE.control} aria-hidden />
            {REVIEW_COMMITS_LABEL.undo}
          </Button>
        }
      />
      <ul aria-label="Rewrite facts" className="flex flex-wrap items-center gap-1.5">
        <li className="list-none">
          <Chip tone="neutral" size="xs" label={commitCountLabel({ count: model.rows.length })} />
        </li>
        <li className="list-none">
          <Chip
            tone="neutral"
            size="xs"
            label={
              run.phase === 'pushed'
                ? REVIEW_COMMITS_LABEL.pushedWithLease
                : REVIEW_COMMITS_LABEL.notPushed
            }
          />
        </li>
      </ul>
    </div>
  );
};
