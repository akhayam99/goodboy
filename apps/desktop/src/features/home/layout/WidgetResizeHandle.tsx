import type { KeyboardEvent, PointerEvent } from 'react';
import { IconButton } from '@goodboy/ui';
import { CornerDownRight } from '@goodboy/ui/icons';
import type { HomeWidgetId, WidgetSize } from '../grid/homeWidgets';
import { SIZE_NAMES } from './sizeNames';

type StepParams = {
  readonly id: HomeWidgetId;
  readonly step: 1 | -1;
  readonly isWrapping: boolean;
};

type PointerParams = {
  readonly id: HomeWidgetId;
  readonly event: PointerEvent<HTMLElement>;
};

type Props = {
  readonly id: HomeWidgetId;
  readonly title: string;
  readonly size: WidgetSize;
  readonly onPointerDown: (params: PointerParams) => void;
  readonly onStep: (params: StepParams) => void;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLElement>;
};

const stepOfKey = ({ event }: KeyParams): 1 | -1 | null => {
  if (event.key === 'ArrowLeft' || event.key === '-') {
    return -1;
  }
  return event.key === 'ArrowRight' || event.key === '+' || event.key === '=' ? 1 : null;
};

export const WidgetResizeHandle = ({ id, title, size, onPointerDown, onStep }: Props) => (
  <span
    data-widget-resize-cell=""
    className="row-actions absolute bottom-1 right-1 z-10 flex items-center group-hover/row:delay-(--delay-step) group-focus-within/row:delay-(--delay-step)"
  >
    <IconButton
      icon={CornerDownRight}
      size="xs"
      label={`Resize ${title}`}
      tooltip={`Resize ${title}, ${SIZE_NAMES[size]}`}
      data-widget-resize=""
      className="cursor-nwse-resize"
      onPointerDown={(event) => onPointerDown({ id, event })}
      onClick={(event) => {
        if (event.detail === 0) {
          onStep({ id, step: event.shiftKey ? -1 : 1, isWrapping: true });
        }
      }}
      onKeyDown={(event) => {
        const step = stepOfKey({ event });
        if (step === null) {
          return;
        }
        event.preventDefault();
        onStep({ id, step, isWrapping: false });
      }}
    />
  </span>
);
