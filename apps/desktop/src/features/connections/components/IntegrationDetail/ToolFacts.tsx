import { Chip } from '@goodboy/ui';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';

type Props = {
  readonly who: string | null;
  readonly facts: ReadonlyArray<string>;
  readonly checkedAt: number | null;
  readonly checkError: string | null;
};

type CheckedParams = {
  readonly checkedAt: number | null;
  readonly checkError: string | null;
  readonly now: number;
};

const CLOCK_MS = 30_000;

const checkedFactOf = ({ checkedAt, checkError, now }: CheckedParams): string | null => {
  if (checkError !== null) {
    return 'Last check failed';
  }
  if (checkedAt === null) {
    return null;
  }
  return `Checked ${formatAge({ from: checkedAt, now })}`;
};

export const ToolFacts = ({ who, facts, checkedAt, checkError }: Props) => {
  const now = useNow(CLOCK_MS);
  const checked = checkedFactOf({ checkedAt, checkError, now });
  const rest = checked === null ? facts : [...facts, checked];
  if (who === null && rest.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Facts" className="flex min-w-0 flex-wrap items-center gap-2">
      {who === null ? null : (
        <li>
          <Chip tone="neutral" emphasis="strong" label={who} />
        </li>
      )}
      {rest.map((fact) => (
        <li key={fact}>
          <Chip tone="neutral" label={fact} />
        </li>
      ))}
    </ul>
  );
};
