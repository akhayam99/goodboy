import { useNow } from '../../../../../shared/hooks/useNow';
import {
  formatAbsoluteDateTime,
  formatRelativeAge,
} from '../../../../../shared/utils/relativeDate';

type Props = {
  readonly fetchedAt: string | null;
};

export const StaleCaption = ({ fetchedAt }: Props) => {
  const now = useNow(30_000, !!fetchedAt);
  if (!fetchedAt) {
    return null;
  }
  const ageMs = now - new Date(fetchedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 60_000) {
    return null;
  }
  return (
    <span
      className="text-3xs text-muted-foreground/60"
      title={`fetched at ${formatAbsoluteDateTime({ iso: fetchedAt })}`}
    >
      updated {formatRelativeAge({ fromIso: fetchedAt, nowMs: now })}
    </span>
  );
};
