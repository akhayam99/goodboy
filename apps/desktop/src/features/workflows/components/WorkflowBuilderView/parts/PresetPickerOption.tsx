import { Trash2 } from 'lucide-react';
import { IconButton, ListboxOptionRow } from '@goodboy/ui';
import type { ListboxMatch } from '@goodboy/ui';
import type { Workflow } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { PresetStepMark } from '../../../presetStepMarksOf';
import { PresetStepMarks } from './PresetStepMarks';

type Props = {
  readonly id: string;
  readonly preset: Workflow;
  readonly marks: ReadonlyArray<PresetStepMark>;
  readonly match: ListboxMatch;
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly onActivate: () => void;
  readonly onExitMarks: () => void;
  readonly onSelect: () => void;
  readonly onDelete: () => void;
};

export const PresetPickerOption = ({
  id,
  preset,
  marks,
  match,
  isActive,
  isSelected,
  onActivate,
  onExitMarks,
  onSelect,
  onDelete,
}: Props) => {
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
          marks.length === 0 ? undefined : <PresetStepMarks marks={marks} onExit={onExitMarks} />
        }
      />
      <IconButton
        icon={Trash2}
        label={`Delete ${preset.name}`}
        variant="ghost"
        iconSize={ICON_SIZE.row}
        onClick={onDelete}
        className="shrink-0"
      />
    </div>
  );
};
