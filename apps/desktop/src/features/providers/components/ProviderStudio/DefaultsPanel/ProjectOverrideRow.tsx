import { RotateCcw } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { ProjectOverrideFacts } from './projectOverrideFacts';

type Props = {
  readonly entry: ProjectOverrideFacts;
  readonly onClear: () => Promise<void>;
};

export const ProjectOverrideRow = ({ entry, onClear }: Props) => (
  <li className="flex min-w-0 items-center justify-between gap-3 text-label">
    <span className="min-w-0 flex-1 truncate text-muted-foreground">
      <span className="text-foreground">{entry.name}</span>
      {`: ${entry.facts.join(', ')}`}
    </span>
    <ConfirmPopover
      role="alert"
      icon={<RotateCcw size={ICON_SIZE.control} aria-hidden />}
      title={`Clear model settings of ${entry.name}?`}
      description="Its orchestrator, summaries and roles follow this page again."
      confirmLabel="Clear"
      align="end"
      onConfirm={onClear}
      trigger={({ arm }) => (
        <Button
          variant="ghost"
          size="xs"
          aria-label={`Clear model settings of ${entry.name}`}
          onClick={arm}
        >
          Clear
        </Button>
      )}
    />
  </li>
);
