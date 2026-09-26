import { Button, ClampedProse } from '@goodboy/ui';
import type { IssueBriefSource } from '../../../../../store/slices/issue-briefs/types';
import { BriefHeader } from './BriefHeader';

type Props = {
  readonly source: IssueBriefSource;
  readonly verbatimGoal: string;
  readonly onUseIssueText: () => void;
  readonly onDismiss: () => void;
};

export const BriefVerbatim = ({ source, verbatimGoal, onUseIssueText, onDismiss }: Props) => (
  <>
    <BriefHeader
      source={source}
      label={`From ${source.identifier}`}
      trailing={
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      }
    />
    <ClampedProse
      text={verbatimGoal}
      lines={4}
      className="text-xs leading-relaxed text-muted-foreground"
    />
    <p className="text-secondary text-faint-foreground">
      No model is free to write a brief, so this is the {source.noun} text as it is.
    </p>
    <footer className="flex items-center gap-1.5">
      <Button size="sm" onClick={onUseIssueText}>
        Use issue text
      </Button>
    </footer>
  </>
);
