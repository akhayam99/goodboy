import type { Ref } from 'react';
import { ICON_SIZE, ListboxTrigger } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { START_KIND_COPY } from '../../../startKind/startKindCopy';
import { START_PICK_TRIGGER } from '../startPickTrigger';

type Props = {
  readonly isOpen: boolean;
  readonly isDisabled: boolean;
  readonly listId: string;
  readonly buttonRef: Ref<HTMLButtonElement>;
  readonly onToggle: () => void;
};

export const TaskPickerTrigger = ({ isOpen, isDisabled, listId, buttonRef, onToggle }: Props) => {
  const TaskIcon = CONCEPT_ICONS.issues;

  return (
    <ListboxTrigger
      variant="field"
      size="sm"
      isOpen={isOpen}
      disabled={isDisabled}
      isBlock={false}
      value=""
      ariaLabel={START_KIND_COPY.pickTask}
      listboxId={listId}
      buttonRef={buttonRef}
      className={START_PICK_TRIGGER}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      <TaskIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground">{START_KIND_COPY.pickTask}</span>
    </ListboxTrigger>
  );
};
