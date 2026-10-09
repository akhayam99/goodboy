import { Button, Input } from '@goodboy/ui';
import type {
  IssueBriefEntry,
  IssueBriefSource,
} from '../../../../../store/slices/issue-briefs/types';
import { BriefFailed } from './BriefFailed';
import { BriefHeader } from './BriefHeader';
import { BriefMeta } from './BriefMeta';

type Props = {
  readonly source: IssueBriefSource;
  readonly entry: IssueBriefEntry | null;
  readonly title: string;
  readonly isBriefShown: boolean;
  readonly hasBrief: boolean;
  readonly onTitleChange: (title: string) => void;
  readonly onUseBrief: () => void;
  readonly onUseIssueText: () => void;
  readonly onRetry: () => void;
};

export const IssueBriefProposal = ({
  source,
  entry,
  title,
  isBriefShown,
  hasBrief,
  onTitleChange,
  onUseBrief,
  onUseIssueText,
  onRetry,
}: Props) => (
  <section
    aria-label={`Brief from ${source.identifier}`}
    aria-busy={entry?.status === 'loading'}
    className="flex flex-col gap-2 rounded-md border border-border-soft bg-subtle p-3"
  >
    <BriefHeader
      source={source}
      label={`Brief from ${source.identifier}`}
      trailing={
        <>
          {entry?.status === 'loading' && (
            <span role="status" className="shrink-0 text-meta text-shimmer">
              Writing a brief
            </span>
          )}
          {entry?.status === 'ready' && (
            <BriefMeta route={entry.route} durationMs={entry.durationMs} costUsd={entry.costUsd} />
          )}
          {hasBrief && isBriefShown && (
            <Button variant="ghost" size="sm" onClick={onUseIssueText}>
              Use the issue text
            </Button>
          )}
          {hasBrief && !isBriefShown && (
            <Button variant="ghost" size="sm" onClick={onUseBrief}>
              Use brief
            </Button>
          )}
        </>
      }
    />
    <Input
      value={title}
      onChange={(event) => onTitleChange(event.target.value)}
      aria-label="Brief title"
      className="h-7 text-heading"
    />
    {entry?.status === 'failed' && <BriefFailed source={source} entry={entry} onRetry={onRetry} />}
    {entry?.status === 'unavailable' && (
      <p className="text-meta text-faint-foreground">
        A brief needs a free model, so this is the {source.noun} text as it is.
      </p>
    )}
    <p className="text-meta text-faint-foreground">
      The full {source.noun} stays linked to this session.
    </p>
  </section>
);
