import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';

type Props = {
  readonly candidate: IssueCandidate;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onPickUp: () => void;
};

export const IssueCandidateRow = ({ candidate, isSelected, onSelect, onPickUp }: Props) => (
  <button
    type="button"
    aria-pressed={isSelected}
    onClick={onSelect}
    onDoubleClick={onPickUp}
    className={cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left',
      ROW_INTERACTIVE,
      isSelected && 'bg-selected',
    )}
  >
    <IntegrationGlyph provider={candidate.provider} size="xs" />
    <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
      {candidate.identifier}
    </span>
    <span className="min-w-0 flex-1 truncate text-body text-foreground">{candidate.title}</span>
  </button>
);
