import { SquareDashedMousePointer } from '@goodboy/ui/icons';
import { Button, ICON_SIZE, useEscapeLayer } from '@goodboy/ui';
import { PromptField } from '../../../../shared/components/PromptField';
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

const noteHeadOf = ({ picks }: HeadParams): string => {
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
  useEscapeLayer(pick.leave);
  const isBlocked = pick.isAdding || pick.agentId === null;
  return (
    <div
      role="group"
      aria-label="Note for the picked element"
      data-browser-pick-note=""
      className="shrink-0 px-2"
    >
      <PromptField
        kind="message"
        label={NOTE_PLACEHOLDER}
        placeholder={NOTE_PLACEHOLDER}
        value={pick.note}
        onChange={(text) => pick.setNote({ text })}
        onSubmit={pick.add}
        isSubmitBlocked={isBlocked}
        autoFocus
        minRows={2}
        maxRows={6}
        header={
          <div className="flex min-w-0 items-center gap-2 px-3 pt-2 text-code text-muted-foreground">
            <SquareDashedMousePointer size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            <span className="truncate">{noteHeadOf({ picks: pick.picks })}</span>
          </div>
        }
        footerStart={<BrowserPickTarget pick={pick} />}
        actions={
          <>
            <Button variant="ghost" size="xs" onClick={pick.leave}>
              Cancel
            </Button>
            <Button size="xs" disabled={isBlocked} onClick={pick.add}>
              {NAMES.addToMessage}
            </Button>
          </>
        }
      />
    </div>
  );
};
