import { Button } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { IssueAdoption } from './issueAdoption';

type Props = {
  readonly adoption: IssueAdoption;
  readonly onUseTitle: () => void;
  readonly onUseGoal: () => void;
  readonly onDismiss: () => void;
};

type RowProps = {
  readonly label: string;
  readonly value: string;
  readonly action: string;
  readonly onUse: () => void;
};

const AdoptionRow = ({ label, value, action, onUse }: RowProps) => (
  <div className="flex items-center gap-2">
    <span className="w-10 shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <span className="min-w-0 flex-1 truncate text-xs text-foreground">{value}</span>
    <Button variant="secondary" size="sm" onClick={onUse}>
      {action}
    </Button>
  </div>
);

export const IssueAdoptionProposal = ({ adoption, onUseTitle, onUseGoal, onDismiss }: Props) => (
  <section
    aria-label="Issue suggestions"
    className="flex flex-col gap-2 rounded-md border border-border-soft bg-muted/30 p-2.5"
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
      <AdoptionRow label="Title" value={adoption.title} action="Use as title" onUse={onUseTitle} />
    ) : null}
    {adoption.goal !== null ? (
      <AdoptionRow label="Goal" value={adoption.goal} action="Use as goal" onUse={onUseGoal} />
    ) : null}
  </section>
);
