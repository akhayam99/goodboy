import { Trash2 } from 'lucide-react';
import { IconButton, ListboxOptionRow, cn } from '@goodboy/ui';
import type { ListboxMatch } from '@goodboy/ui';
import type { Workflow } from '@goodboy/types';
import { agentKindPalette, classifyStep } from '../../../agent-kind';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly id: string;
  readonly preset: Workflow;
  readonly match: ListboxMatch;
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly onActivate: () => void;
  readonly onSelect: () => void;
  readonly onDelete: () => void;
};

const MAX_DOTS = 6;

export const PresetPickerOption = ({
  id,
  preset,
  match,
  isActive,
  isSelected,
  onActivate,
  onSelect,
  onDelete,
}: Props) => {
  const steps = [...preset.steps].sort((first, second) => first.ordinal - second.ordinal);
  const kinds = steps.map((step) => classifyStep({ step }));
  const description = preset.description !== '' ? preset.description : (preset.goal ?? '');
  return (
    <div className="group/preset flex min-w-0 items-center gap-1">
      <ListboxOptionRow
        id={id}
        value={preset.id}
        label={preset.name}
        description={description === '' ? undefined : description}
        match={match}
        isActive={isActive}
        isSelected={isSelected}
        onActivate={onActivate}
        onSelect={onSelect}
        meta={
          <span aria-hidden className="flex items-center gap-1">
            {kinds.slice(0, MAX_DOTS).map((kind, index) => (
              <span
                key={`${kind}-${index}`}
                className={cn('size-2 rounded-full', agentKindPalette({ kind }).bg)}
              />
            ))}
          </span>
        }
      />
      <IconButton
        icon={Trash2}
        label={`Delete ${preset.name}`}
        variant="ghost"
        iconSize={ICON_SIZE.row}
        onClick={onDelete}
        className="shrink-0 opacity-0 focus-visible:opacity-100 group-hover/preset:opacity-100"
      />
    </div>
  );
};
