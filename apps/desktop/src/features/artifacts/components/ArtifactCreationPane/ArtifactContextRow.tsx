import { StatusDot, type Tone } from '@goodboy/ui';
import type {
  ArtifactContextInventoryRow,
  ArtifactContextRowState,
} from '../../artifactContextInventory';

type Props = {
  readonly row: ArtifactContextInventoryRow;
};

const ROW_TONE: Record<ArtifactContextRowState, Tone> = {
  included: 'success',
  partial: 'warning',
  missing: 'neutral',
};

export const ArtifactContextRow = ({ row }: Props) => (
  <li data-testid="artifact-context-row" className="flex min-w-0 items-start gap-2">
    <StatusDot tone={ROW_TONE[row.state]} size="sm" className="mt-1.5" />
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-foreground">{row.label}</span>
      <span className="text-2xs leading-relaxed text-muted-foreground">{row.summary}</span>
      {row.detail.map((line) => (
        <span key={line} className="text-2xs leading-relaxed text-muted-foreground/70">
          {line}
        </span>
      ))}
    </span>
  </li>
);
