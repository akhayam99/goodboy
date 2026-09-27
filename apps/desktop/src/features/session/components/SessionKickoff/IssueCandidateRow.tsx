import { cn } from '@goodboy/ui';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';

type Props = {
  readonly candidate: IssueCandidate;
  readonly isSelected: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
  readonly onPickUp: () => void;
};

export const IssueCandidateRow = ({
  candidate,
  isSelected,
  disabled,
  onSelect,
  onPickUp,
}: Props) => (
  <button
    type="button"
    aria-pressed={isSelected}
    disabled={disabled}
    onClick={onSelect}
    onDoubleClick={onPickUp}
    className={cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left motion-safe:transition-colors disabled:opacity-60',
      isSelected ? 'bg-selected' : 'hover:bg-hover',
    )}
  >
    <IntegrationGlyph provider={candidate.provider} size="xs" />
    <span className="shrink-0 font-mono text-secondary text-muted-foreground">
      {candidate.identifier}
    </span>
    <span className="min-w-0 flex-1 truncate text-body text-foreground">{candidate.title}</span>
  </button>
);
