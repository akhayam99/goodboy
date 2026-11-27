import { IconButton } from '@goodboy/ui';
import { EyeOff, GripVertical } from '@goodboy/ui/icons';
import type { HomeWidgetId } from '../grid/homeWidgets';
import type { WidgetGesture, WidgetMenuOpen } from './layoutTypes';

type Props = {
  readonly id: HomeWidgetId;
  readonly title: string;
  readonly onHide: (params: WidgetGesture) => void;
  readonly onMenu: (params: WidgetMenuOpen) => void;
};

export const WidgetControls = ({ id, title, onHide, onMenu }: Props) => (
  <span
    data-widget-controls=""
    className="row-actions absolute right-2 top-2 z-10 flex items-center"
  >
    <IconButton
      icon={GripVertical}
      size="xs"
      label={`Options for ${title}`}
      aria-haspopup="menu"
      data-widget-grip=""
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
