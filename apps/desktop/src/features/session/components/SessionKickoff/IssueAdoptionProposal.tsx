import { Button } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { AdoptionRow } from './AdoptionRow';
import type { IssueAdoption } from './issueAdoption';

type Props = {
  readonly adoption: IssueAdoption;
  readonly onUseTitle: () => void;
  readonly onUseGoal: () => void;
  readonly onDismiss: () => void;
};

export const IssueAdoptionProposal = ({ adoption, onUseTitle, onUseGoal, onDismiss }: Props) => (
  <section
    aria-label="Issue suggestions"
    className="flex flex-col gap-2 rounded-md border border-border-soft bg-subtle p-2.5"
  >
    <header className="flex items-center gap-2">
      <CONCEPT_ICONS.issues
        size={ICON_SIZE.row}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        {adoption.identifier} is linked. Take what you want from it, nothing is applied on its own.
      </p>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </header>
    {adoption.title !== null ? (
      <AdoptionRow
        label="Title"
        value={adoption.title}
        action="Use as title"
        isProse={false}
        onUse={onUseTitle}
      />
    ) : null}
    {adoption.goal !== null ? (
      <AdoptionRow
        label="Goal"
        value={adoption.goal}
        action="Use as goal"
        isProse
        onUse={onUseGoal}
      />
    ) : null}
  </section>
);
