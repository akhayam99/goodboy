import { Button, Notice } from '@goodboy/ui';
import type {
  IssueBriefEntry,
  IssueBriefSource,
} from '../../../../../store/slices/issue-briefs/types';
import { issueBriefFailureText } from '../../../../integrations/shared/issueBriefFailureText';

type Props = {
  readonly source: IssueBriefSource;
  readonly entry: Extract<IssueBriefEntry, { status: 'failed' }>;
  readonly onRetry: () => void;
  readonly onUseIssueText: () => void;
  readonly onDismiss: () => void;
};

export const BriefFailed = ({ source, entry, onRetry, onUseIssueText, onDismiss }: Props) => (
  <Notice
    tone="danger"
    placement="inline"
    role="alert"
    title={`Couldn't write a brief for ${source.identifier}`}
    body={issueBriefFailureText({ failure: entry.failure })}
    detail={entry.detail}
    actions={
      <>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
        <Button variant="ghost" size="sm" onClick={onUseIssueText}>
          Use issue text
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </>
    }
  />
);
