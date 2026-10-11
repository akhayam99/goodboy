import { Check } from 'lucide-react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';

type Props = {
  readonly candidate: IssueCandidate;
  readonly isSelected: boolean;
  readonly isSelecting: boolean;
  readonly onToggle: () => void;
  readonly onFocusRow: () => void;
  readonly onPickAlone: () => void;
  readonly onConfirm: () => void;
};

export const IssueCandidateRow = ({
  candidate,
  isSelected,
  isSelecting,
  onToggle,
  onFocusRow,
  onPickAlone,
  onConfirm,
}: Props) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={isSelected}
    onClick={onToggle}
    onDoubleClick={onPickAlone}
    onFocus={onFocusRow}
    onKeyDown={(event) => {
      if (event.key !== 'Enter') {
        return;
      }
      event.preventDefault();
      onConfirm();
    }}
    className={cn(
      'group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left',
      ROW_INTERACTIVE,
      isSelected && 'bg-selected',
    )}
  >
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      <span
        className={cn(
          'flex items-center justify-center',
          isSelecting ? 'invisible' : 'group-hover:invisible',
        )}
      >
        <IntegrationGlyph provider={candidate.provider} size="xs" />
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 items-center justify-center rounded-sm border border-border',
          isSelecting ? 'flex' : 'hidden group-hover:flex',
          isSelected && 'border-transparent bg-primary text-primary-foreground',
        )}
      >
        {isSelected ? <Check className="size-3" /> : null}
      </span>
    </span>
    <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
      {candidate.identifier}
    </span>
    <span className="min-w-0 flex-1 truncate text-body text-foreground">{candidate.title}</span>
  </button>
);
