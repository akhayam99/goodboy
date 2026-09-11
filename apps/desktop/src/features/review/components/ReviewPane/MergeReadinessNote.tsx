import { AlertTriangle } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { PrMergeReadiness } from '../../prMergeReadiness';

type Props = {
  readonly readiness: PrMergeReadiness;
};

export const MergeReadinessNote = ({ readiness }: Props) => {
  if (readiness.status === 'ready' && readiness.caveats.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-border p-2">
      <p className="flex min-w-0 items-start gap-1 font-semibold text-foreground">
        <AlertTriangle size={ICON_SIZE.row} aria-hidden className="mt-px shrink-0" />
        {readiness.reason}
      </p>
      {readiness.caveats.length > 0 && (
        <ul className="flex min-w-0 flex-col gap-0.5 text-muted-foreground">
          {readiness.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
