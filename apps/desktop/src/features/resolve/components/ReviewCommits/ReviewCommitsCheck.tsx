import { Button, Notice } from '@goodboy/ui';
import { CHECK_COPY, REVIEW_COMMITS_LABEL, conflictLine } from '../../reviewCommitsCopy';
import type { ReviewCommitsModel } from './useReviewCommits';

type Props = {
  readonly model: ReviewCommitsModel;
};

export const ReviewCommitsCheck = ({ model }: Props) => {
  if (!model.hasChange || model.isForeign) {
    return null;
  }
  if (model.isPredicting) {
    return (
      <p role="status" className="text-label text-faint-foreground">
        {CHECK_COPY.predicting}
      </p>
    );
  }
  if (model.prediction === null || !model.prediction.isSupported) {
    return <Notice tone="info" placement="inline" title={CHECK_COPY.unsupported} />;
  }
  if (model.conflicts.length > 0) {
    return (
      <Notice
        tone="warning"
        placement="inline"
        title={conflictLine({ files: model.conflicts })}
        body={CHECK_COPY.conflictHint}
        actions={
          <Button variant="secondary" size="sm" onClick={model.openHistory}>
            {REVIEW_COMMITS_LABEL.openHistory}
          </Button>
        }
      />
    );
  }
  return (
    <Notice
      tone="success"
      placement="inline"
      title={CHECK_COPY.clean}
      body={model.prediction.isTreeEqual ? CHECK_COPY.sameCode : undefined}
    />
  );
};
