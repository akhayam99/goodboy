import type { KeyboardEvent } from 'react';
import { IconButton } from '@goodboy/ui';
import { EyeOff, GripVertical } from '@goodboy/ui/icons';
import type { HomeWidgetId } from '../grid/homeWidgets';
import type { WidgetGesture, WidgetMenuOpen } from './layoutTypes';

type GripKeyParams = {
  readonly id: HomeWidgetId;
  readonly event: KeyboardEvent<HTMLElement>;
};

type Props = {
  readonly id: HomeWidgetId;
  readonly title: string;
  readonly onHide: (params: WidgetGesture) => void;
  readonly onMenu: (params: WidgetMenuOpen) => void;
  readonly onGripKeyDown: (params: GripKeyParams) => void;
};

export const WidgetControls = ({ id, title, onHide, onMenu, onGripKeyDown }: Props) => (
  <span
    data-widget-controls=""
    className="row-actions absolute right-2 top-2 z-10 flex items-center group-hover/row:delay-(--delay-step) group-focus-within/row:delay-(--delay-step)"
  >
    <IconButton
      icon={GripVertical}
      size="xs"
      label={`Options for ${title}`}
      aria-haspopup="menu"
      aria-roledescription="sortable widget"
      data-widget-grip=""
      className="cursor-grab"
      onKeyDown={(event) => onGripKeyDown({ id, event })}
      onClick={(event) => onMenu({ opener: event.currentTarget })}
    />
    <IconButton
      icon={EyeOff}
      size="xs"
      label={`Hide ${title}`}
      data-widget-hide=""
      onClick={() => onHide({ id })}
    />
  </span>
);
