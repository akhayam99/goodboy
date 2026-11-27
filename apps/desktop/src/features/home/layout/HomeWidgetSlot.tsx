import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ContextMenu, type MenuEntry, type MenuPoint } from '@goodboy/ui';
import { EyeOff } from '@goodboy/ui/icons';
import type { HomeWidgetId } from '../grid/homeWidgets';
import type { WidgetGesture, WidgetMenuOpen } from './layoutTypes';
import { WidgetControls } from './WidgetControls';

type Props = {
  readonly id: HomeWidgetId;
  readonly title: string;
  readonly onHide: (params: WidgetGesture) => void;
  readonly children: ReactNode;
};

const KEYBOARD_INSET = 8;

type KeyParams = {
  readonly event: KeyboardEvent<HTMLElement>;
};

const isMenuKey = ({ event }: KeyParams): boolean =>
  (event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu';

export const HomeWidgetSlot = ({ id, title, onHide, children }: Props) => {
  const [point, setPoint] = useState<MenuPoint | null>(null);
  const entries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'item',
      key: 'hide',
      label: `Hide ${title}`,
      icon: EyeOff,
      onSelect: () => onHide({ id }),
    },
  ];
  return (
    <div
      data-home-slot={id}
      className="group/row relative flex h-full min-h-0 min-w-0 flex-col"
      onContextMenu={(event: MouseEvent<HTMLElement>) => {
        event.preventDefault();
        setPoint({ x: event.clientX, y: event.clientY });
      }}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.defaultPrevented || !isMenuKey({ event })) {
          return;
        }
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        setPoint({ x: rect.left + KEYBOARD_INSET, y: rect.top + KEYBOARD_INSET });
      }}
    >
      <WidgetControls
        id={id}
        title={title}
        onHide={onHide}
        onMenu={(params: WidgetMenuOpen) => {
          const rect = params.opener.getBoundingClientRect();
          setPoint({ x: rect.left, y: rect.bottom });
        }}
      />
      {children}
      {point === null ? null : (
        <ContextMenu
          label={`${title} options`}
          point={point}
          entries={entries}
          onClose={() => setPoint(null)}
        />
      )}
    </div>
  );
};
