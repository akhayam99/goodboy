import { Check, Trash2 } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { SavedModelFacts } from './savedModelFacts';

type Props = {
  readonly entry: SavedModelFacts;
  readonly onApply: () => Promise<void>;
  readonly onDiscard: () => Promise<void>;
};

export const SavedModelsRow = ({ entry, onApply, onDiscard }: Props) => (
  <li className="flex min-w-0 items-center justify-between gap-3 text-label">
    <span className="min-w-0 flex-1 truncate text-muted-foreground">
      <span className="text-foreground">{entry.name}</span>
      {`: ${entry.facts.join(', ')}`}
    </span>
    <span className="flex items-center gap-1">
      <ConfirmPopover
        role="alert"
        icon={<Check size={ICON_SIZE.control} aria-hidden />}
        title={`Apply the saved settings of ${entry.name} to this page?`}
        description="They replace the pins this page has for the same roles and tasks."
        confirmLabel="Apply"
        align="end"
        onConfirm={onApply}
        trigger={({ arm }) => (
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Apply the saved settings of ${entry.name} to this page`}
            onClick={arm}
          >
            Apply to this page
          </Button>
        )}
      />
      <ConfirmPopover
        role="alert"
        icon={<Trash2 size={ICON_SIZE.control} aria-hidden />}
        title={`Discard the saved settings of ${entry.name}?`}
        description="They are deleted and cannot be brought back."
        confirmLabel="Discard"
        align="end"
        onConfirm={onDiscard}
        trigger={({ arm }) => (
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Discard the saved settings of ${entry.name}`}
            onClick={arm}
          >
            Discard
          </Button>
        )}
      />
    </span>
  </li>
);
