import type { KeyboardEvent } from 'react';
import { SquareDashedMousePointer } from '@goodboy/ui/icons';
import { Button, FormActions, ICON_SIZE, Textarea } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import { elementNameOf } from '../../elementNameOf';
import type { ElementPick } from '../../hooks/useElementPick';
import type { BrowserPickedElement } from '../../types';
import { BrowserPickTarget } from './BrowserPickTarget';

const NOTE_PLACEHOLDER = 'What should change?';

type Props = {
  readonly pick: ElementPick;
};

type HeadParams = {
  readonly picks: ReadonlyArray<BrowserPickedElement>;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLTextAreaElement>;
};

const headOf = ({ picks }: HeadParams): string => {
  const first = picks[0];
  if (picks.length > 1 || first === undefined) {
    return `${picks.length} elements`;
  }
  const name =
    first.component === null ? elementNameOf({ element: first }) : `<${first.component}>`;
  if (first.source === null) {
    return first.component === null ? name : `${name}  ${first.label}`;
  }
  return `${name}  ${first.source.path.replace(/^\/+/, '')}:${first.source.line}`;
};

export const BrowserPickNote = ({ pick }: Props) => {
  const handleKeyDown = ({ event }: KeyParams): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      pick.leave();
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    pick.add();
  };

  return (
    <div className="shrink-0 px-2">
      <div
        role="group"
        aria-label="Note for the picked element"
        data-browser-pick-note=""
        className="flex flex-col gap-2 rounded-md bg-subtle p-2"
      >
        <div className="flex min-w-0 items-center gap-2 text-code text-muted-foreground">
          <SquareDashedMousePointer size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="truncate">{headOf({ picks: pick.picks })}</span>
        </div>
        <Textarea
          value={pick.note}
          placeholder={NOTE_PLACEHOLDER}
          aria-label={NOTE_PLACEHOLDER}
          autoFocus
          autoGrow
          minRows={2}
          maxRows={6}
          onChange={(event) => pick.setNote({ text: event.target.value })}
          onKeyDown={(event) => handleKeyDown({ event })}
        />
        <FormActions leading={<BrowserPickTarget pick={pick} />} error={pick.error}>
          <Button variant="ghost" size="xs" onClick={pick.leave}>
            Cancel
          </Button>
          <Button size="xs" disabled={pick.isAdding || pick.agentId === null} onClick={pick.add}>
            {NAMES.addToMessage}
          </Button>
        </FormActions>
      </div>
    </div>
  );
};
