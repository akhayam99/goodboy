import { useState } from 'react';
import type {
  IssueBriefEntry,
  IssueBriefSource,
} from '../../../../../store/slices/issue-briefs/types';
import { briefGoalText } from '../../../../integrations/shared/briefGoalText';
import { BriefEditor } from './BriefEditor';
import { BriefFailed } from './BriefFailed';
import { BriefLoading } from './BriefLoading';
import { BriefReady } from './BriefReady';
import { BriefVerbatim } from './BriefVerbatim';

type ApplyParams = {
  readonly title: string;
  readonly goal: string;
};

type Props = {
  readonly source: IssueBriefSource;
  readonly entry: IssueBriefEntry | null;
  readonly verbatimGoal: string;
  readonly isTitleLocked: boolean;
  readonly onApply: (params: ApplyParams) => void;
  readonly onUseTitle: (params: Pick<ApplyParams, 'title'>) => void;
  readonly onUseIssueText: () => void;
  readonly onRetry: () => void;
  readonly onDismiss: () => void;
};

const SURFACE = 'flex flex-col gap-2 rounded-md border border-border-soft bg-subtle p-2.5';

export const IssueBriefProposal = ({
  source,
  entry,
  verbatimGoal,
  isTitleLocked,
  onApply,
  onUseTitle,
  onUseIssueText,
  onRetry,
  onDismiss,
}: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const label = `Brief from ${source.identifier}`;

  if (entry?.status === 'failed') {
    return (
      <section aria-label={label}>
        <BriefFailed
          source={source}
          entry={entry}
          onRetry={onRetry}
          onUseIssueText={onUseIssueText}
          onDismiss={onDismiss}
        />
      </section>
    );
  }

  if (entry?.status === 'unavailable') {
    return (
      <section aria-label={label} className={SURFACE}>
        <BriefVerbatim
          source={source}
          verbatimGoal={verbatimGoal}
          onUseIssueText={onUseIssueText}
          onDismiss={onDismiss}
        />
      </section>
    );
  }

  if (entry?.status !== 'ready') {
    return (
      <section aria-label={label} aria-busy className={SURFACE}>
        <BriefLoading source={source} onUseIssueText={onUseIssueText} onDismiss={onDismiss} />
      </section>
    );
  }

  const goal = briefGoalText({ brief: entry.brief, source });

  if (isEditing) {
    return (
      <section aria-label={label} className={SURFACE}>
        <BriefEditor
          source={source}
          initialTitle={entry.brief.title}
          initialGoal={goal}
          onSave={onApply}
          onCancel={() => setIsEditing(false)}
        />
      </section>
    );
  }

  return (
    <section aria-label={label} className={SURFACE}>
      <BriefReady
        source={source}
        entry={entry}
        isTitleLocked={isTitleLocked}
        onUseBrief={() => onApply({ title: entry.brief.title, goal })}
        onUseTitle={() => onUseTitle({ title: entry.brief.title })}
        onEdit={() => setIsEditing(true)}
        onUseIssueText={onUseIssueText}
        onDismiss={onDismiss}
      />
    </section>
  );
};
