import { cn, tintClasses } from '@goodboy/ui';

type Props = {
  readonly number: number;
  readonly isClosed?: boolean;
  readonly isLead?: boolean;
};

const LEAD = tintClasses('primary');

export const DecisionNumber = ({ number, isClosed = false, isLead = false }: Props) => (
  <span
    aria-hidden
    className={cn(
      'flex size-5 shrink-0 items-center justify-center rounded-full text-chip',
      isLead && cn(LEAD.bg, LEAD.text),
      !isLead && 'bg-fill',
      !isLead && (isClosed ? 'text-faint-foreground' : 'text-muted-foreground'),
    )}
  >
    {number}
  </span>
);
