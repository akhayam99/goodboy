import { Button, ClampedProse } from '@goodboy/ui';
import type {
  IssueBriefEntry,
  IssueBriefSource,
} from '../../../../../store/slices/issue-briefs/types';
import { BriefHeader } from './BriefHeader';
import { BriefMeta } from './BriefMeta';

type Props = {
  readonly source: IssueBriefSource;
  readonly entry: Extract<IssueBriefEntry, { status: 'ready' }>;
  readonly isTitleLocked: boolean;
  readonly onUseBrief: () => void;
  readonly onUseTitle: () => void;
  readonly onEdit: () => void;
  readonly onUseIssueText: () => void;
  readonly onDismiss: () => void;
};

export const BriefReady = ({
  source,
  entry,
  isTitleLocked,
  onUseBrief,
  onUseTitle,
  onEdit,
  onUseIssueText,
  onDismiss,
}: Props) => (
  <>
    <BriefHeader
      source={source}
      label={`Brief from ${source.identifier}`}
      trailing={
        <BriefMeta route={entry.route} durationMs={entry.durationMs} costUsd={entry.costUsd} />
      }
    />
    <div className="flex items-start gap-2">
      <h4 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
        {entry.brief.title}
      </h4>
      {isTitleLocked && (
        <Button variant="secondary" size="sm" onClick={onUseTitle}>
          Use as title
        </Button>
      )}
    </div>
    <ClampedProse
      text={entry.brief.goal}
      lines={4}
      className="text-xs leading-relaxed text-muted-foreground"
    />
    {entry.brief.acceptance.length > 0 && (
      <ul aria-label="Done when" className="flex flex-col gap-1">
        {entry.brief.acceptance.map((criterion) => (
          <li key={criterion} className="flex items-start gap-1.5 text-2xs text-muted-foreground">
            <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-faint-foreground" />
            <span className="min-w-0 flex-1">{criterion}</span>
          </li>
        ))}
      </ul>
    )}
    <p className="text-2xs text-faint-foreground">
      The full {source.noun} stays linked to this session.
    </p>
    <footer className="flex items-center gap-1.5">
      <Button size="sm" onClick={onUseBrief}>
        Use brief
      </Button>
      <Button variant="secondary" size="sm" onClick={onEdit}>
        Edit
      </Button>
      <Button variant="ghost" size="sm" onClick={onUseIssueText}>
        Use issue text
      </Button>
      <span className="flex-1" />
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </footer>
  </>
);
