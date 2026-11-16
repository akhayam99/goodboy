import { cn } from '@goodboy/ui';
import { DecisionNumber } from './DecisionNumber';
import { SummaryLine } from './SummaryLine';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly items: ReadonlyArray<string>;
};

export const SummaryStepList = ({ id, label, items }: Props) => (
  <ol id={id} aria-label={label} className="flex min-w-0 flex-col gap-2">
    {items.map((item, index) => (
      <li
        key={`${index}-${item}`}
        data-summary-step={index === 0 ? 'first' : undefined}
        className="flex min-w-0 items-start gap-3"
      >
        <DecisionNumber number={index + 1} isLead={index === 0} />
        <SummaryLine
          item={item}
          className={cn('text-body', index === 0 ? 'text-foreground' : 'text-muted-foreground')}
        />
      </li>
    ))}
  </ol>
);
