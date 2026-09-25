import { Button, Chip } from '@goodboy/ui';
import type {
  IssueBriefEntry,
  IssueBriefSource,
} from '../../../../store/slices/issue-briefs/types';
import { IntegrationGlyph } from '../IntegrationGlyph';
import { issueBriefFailureText } from '../../shared/issueBriefFailureText';

type Props = {
  readonly source: IssueBriefSource;
  readonly entry: IssueBriefEntry;
  readonly isShowingBrief: boolean;
  readonly onToggle: () => void;
  readonly onRetry: () => void;
};

export const BriefStrip = ({ source, entry, isShowingBrief, onToggle, onRetry }: Props) => (
  <div className="flex min-h-6 items-center gap-2 px-2">
    <IntegrationGlyph provider={source.provider} size="xs" />
    <span className="shrink-0 font-mono text-2xs text-muted-foreground">{source.identifier}</span>
    {entry.status === 'loading' && (
      <span role="status" className="min-w-0 flex-1 truncate text-2xs text-shimmer">
        Writing a brief
      </span>
    )}
    {entry.status === 'ready' && (
      <>
        <Chip tone="primary" size="xs" bordered={false} label="Brief ready" />
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onToggle}>
          {isShowingBrief ? 'Show issue text' : 'Use brief'}
        </Button>
      </>
    )}
    {entry.status === 'failed' && (
      <>
        <span role="alert" className="min-w-0 flex-1 truncate text-2xs text-danger">
          {`Couldn't write a brief. ${issueBriefFailureText({ failure: entry.failure })}`}
        </span>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </>
    )}
  </div>
);
