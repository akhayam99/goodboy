import {
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { ContextMenu, cn, type MenuEntry, type MenuPoint } from '@goodboy/ui';
import { ArrowLeft, ArrowRight, EyeOff } from '@goodboy/ui/icons';
import type { ReorderStepParams } from './layoutTypes';
import type { HomeWidgetId, WidgetSize } from '../grid/homeWidgets';
import type { ResizeParams, StepParams } from '../grid/gridEditingTypes';
import { sizesAvailableOf } from './sizesAvailableOf';
import { SIZE_NAMES } from './sizeNames';
import { sizeSelectionOf } from './sizeSelectionOf';
import type { WidgetGesture, WidgetMenuOpen } from './layoutTypes';
import { WidgetControls } from './WidgetControls';
import { WidgetResizeHandle } from './WidgetResizeHandle';

type PointerParams = {
  readonly id: HomeWidgetId;
  readonly event: PointerEvent<HTMLElement>;
};

type GripKeyParams = {
  readonly id: HomeWidgetId;
  readonly event: KeyboardEvent<HTMLElement>;
};

type Props = {
  readonly id: HomeWidgetId;
  readonly title: string;
  readonly size: WidgetSize;
  readonly position: { readonly index: number; readonly count: number };
  readonly isLifted: boolean;
  readonly isGrabbed: boolean;
  readonly isResizing: boolean;
  readonly isLeaving: boolean;
  readonly isArriving: boolean;
  readonly onHide: (params: WidgetGesture) => void;
  readonly onStepMove: (params: StepParams) => void;
  readonly onResize: (params: ResizeParams) => void;
  readonly onPointerDown: (params: PointerParams) => void;
  readonly onGripKeyDown: (params: GripKeyParams) => void;
  readonly onResizePointerDown: (params: PointerParams) => void;
  readonly onResizeStep: (params: ReorderStepParams) => void;
  readonly children: ReactNode;
};

const KEYBOARD_INSET = 8;

type KeyParams = {
  readonly event: KeyboardEvent<HTMLElement>;
};

const isMenuKey = ({ event }: KeyParams): boolean =>
  (event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu';

export const HomeWidgetSlot = ({
  id,
  title,
  size,
  position,
  isLifted,
  isGrabbed,
  isResizing,
  isLeaving,
  isArriving,
  onHide,
  onStepMove,
  onResize,
  onPointerDown,
  onGripKeyDown,
  onResizePointerDown,
  onResizeStep,
  children,
}: Props) => {
  const [point, setPoint] = useState<MenuPoint | null>(null);
  const sizes = sizesAvailableOf({ id });
  const entries: ReadonlyArray<MenuEntry> = [
    ...(sizes.length < 2
      ? []
      : [
          {
            kind: 'item',
            key: 'size',
            label: 'Size',
            choices: sizes.map((choice) => ({
              id: choice,
              label: SIZE_NAMES[choice],
              isCurrent: choice === size,
            })),
            onSelect: sizeSelectionOf({ id, sizes, onResize }),
          } satisfies MenuEntry,
        ]),
    ...(position.index === 0
      ? []
      : [
          {
            kind: 'item',
            key: 'earlier',
            label: 'Move earlier',
            icon: ArrowLeft,
            onSelect: () => onStepMove({ id, step: -1 }),
          } satisfies MenuEntry,
        ]),
    ...(position.index === position.count - 1
      ? []
      : [
          {
            kind: 'item',
            key: 'later',
            label: 'Move later',
            icon: ArrowRight,
            onSelect: () => onStepMove({ id, step: 1 }),
          } satisfies MenuEntry,
        ]),
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
      data-lifted={isLifted ? '' : undefined}
      data-active={isGrabbed || isResizing ? '' : undefined}
      data-grabbed={isGrabbed ? '' : undefined}
      data-leaving={isLeaving ? '' : undefined}
      data-arriving={isArriving ? '' : undefined}
      className={cn(
        'group/row relative flex h-full min-h-0 min-w-0 flex-col rounded-lg',
        'motion-safe:transition-[scale,box-shadow,opacity] motion-safe:duration-(--duration-quick)',
        isLeaving ? 'opacity-0 motion-safe:ease-(--ease-exit)' : 'motion-safe:ease-(--ease-enter)',
        isArriving && 'motion-safe:animate-text-swap',
        isGrabbed && 'shadow-xl ring-1 ring-focus-ring',
        isLifted && 'pointer-events-none z-(--z-index-drag) motion-safe:scale-[1.02]',
        isResizing && 'outline outline-1 outline-dashed outline-focus-ring',
      )}
      onPointerDown={(event) => onPointerDown({ id, event })}
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
        onGripKeyDown={onGripKeyDown}
        onMenu={(params: WidgetMenuOpen) => {
          const rect = params.opener.getBoundingClientRect();
          setPoint({ x: rect.left, y: rect.bottom });
        }}
      />
      {children}
      {sizes.length < 2 ? null : (
        <WidgetResizeHandle
          id={id}
          title={title}
          size={size}
          onPointerDown={onResizePointerDown}
          onStep={onResizeStep}
        />
      )}
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
