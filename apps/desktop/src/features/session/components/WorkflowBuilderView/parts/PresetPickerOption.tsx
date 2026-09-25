import { Trash2 } from 'lucide-react';
import { IconButton, cn } from '@goodboy/ui';
import type { Workflow } from '@goodboy/types';
import { agentKindPalette, classifyStep } from '../../../agent-kind';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly preset: Workflow;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onDelete: () => void;
};

const MAX_DOTS = 6;

export const PresetPickerOption = ({ preset, isSelected, onSelect, onDelete }: Props) => {
  const steps = [...preset.steps].sort((first, second) => first.ordinal - second.ordinal);
  const kinds = steps.map((step) => classifyStep({ step }));
  const description = preset.description !== '' ? preset.description : (preset.goal ?? '');
  return (
    <div
      className={cn(
        'group/preset flex min-w-0 items-center gap-1 rounded-md pr-1 transition-colors',
        isSelected ? 'bg-hover' : 'hover:bg-hover',
      )}
    >
      <button
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-xs text-foreground">{preset.name}</span>
            <span className="shrink-0 text-3xs tabular-nums text-faint-foreground">
              {steps.length}
            </span>
          </span>
          {description === '' ? null : (
            <span className="truncate text-2xs text-faint-foreground">{description}</span>
          )}
        </span>
        <span aria-hidden className="flex shrink-0 items-center gap-1">
          {kinds.slice(0, MAX_DOTS).map((kind, index) => (
            <span
              key={`${kind}-${index}`}
              className={cn('size-2 rounded-full', agentKindPalette({ kind }).bg)}
            />
          ))}
        </span>
      </button>
      <IconButton
        icon={Trash2}
        label={`Delete ${preset.name}`}
        variant="ghost"
        iconSize={ICON_SIZE.row}
        onClick={onDelete}
        className="opacity-0 focus-visible:opacity-100 group-hover/preset:opacity-100"
      />
    </div>
  );
};
