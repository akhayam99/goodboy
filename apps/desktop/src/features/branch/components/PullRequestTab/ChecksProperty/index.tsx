import { cn, StatusDot } from '@goodboy/ui';
import type { ChecksSummary } from '../../../../integrations/github/checksRollup';
import { PROPERTY_ROW } from '../propertyRow';
import { PropertyField } from '../PropertyField';

type Props = {
  readonly summary: ChecksSummary | null;
};

const MAX_FAILING_NAMES = 3;

type BarParams = {
  readonly summary: ChecksSummary;
};

const barOf = ({ summary }: BarParams): ReadonlyArray<string> => [
  ...Array.from({ length: summary.passed }, () => 'bg-success'),
  ...Array.from({ length: summary.running }, () => 'bg-info'),
  ...Array.from({ length: summary.failing }, () => 'bg-danger'),
];

export const ChecksProperty = ({ summary }: Props) => {
  if (summary === null) {
    return null;
  }
  return (
    <PropertyField label="Checks" action={<span data-testid="checks-line">{summary.line}</span>}>
      <div className="flex min-w-0 flex-col gap-2">
        <ul
          aria-hidden
          data-slot="checks-bar"
          className="flex h-1 min-w-0 gap-0.5 overflow-hidden rounded-sm"
        >
          {barOf({ summary }).map((tone, position) => (
            <li key={position} className={cn('h-full min-w-0 flex-1 rounded-sm', tone)} />
          ))}
        </ul>
        {summary.failingNames.length === 0 ? null : (
          <ul aria-label="Failing checks" className="flex min-w-0 flex-col">
            {summary.failingNames.slice(0, MAX_FAILING_NAMES).map((name) => (
              <li key={name} className={PROPERTY_ROW}>
                <StatusDot tone="danger" />
                <span className="min-w-0 flex-1 truncate text-foreground">{name}</span>
                <span className="shrink-0 text-meta text-danger">Failed</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PropertyField>
  );
};
