import { cn } from '../../cn';
import { ICON_SIZE, ICON_STROKE } from '../../iconSize';
import { tintClasses } from '../../tint';
import { STATUS_MARK_DRAWING, type StatusMarkSpec } from './statusMarkSpec';

type Props = {
  readonly mark: StatusMarkSpec;
  readonly label?: string;
  readonly className?: string;
};

type DrawingParams = {
  readonly mark: StatusMarkSpec;
};

const drawingOf = ({ mark }: DrawingParams) => {
  switch (mark.kind) {
    case 'empty':
      return null;
    case 'dot':
      return <span className={cn('size-1.5 rounded-full', tintClasses(mark.tone).dot)} />;
    case 'count':
      return (
        <span
          className={cn(
            'text-chip tabular-nums',
            mark.tone === 'neutral' ? 'text-faint-foreground' : tintClasses(mark.tone).text,
          )}
        >
          {mark.text}
        </span>
      );
    case 'state': {
      const drawing = STATUS_MARK_DRAWING[mark.state];
      if (drawing.kind === 'ring') {
        return (
          <span
            className={cn(
              'spin-border size-3 rounded-full ring-1 ring-inset ring-border-soft',
              drawing.className,
            )}
          />
        );
      }
      const Icon = drawing.icon;
      return (
        <Icon
          size={ICON_SIZE.row}
          strokeWidth={ICON_STROKE.row}
          aria-hidden
          className={drawing.className}
        />
      );
    }
    default: {
      const unreachable: never = mark;
      return unreachable;
    }
  }
};

export const StatusMark = ({ mark, label, className }: Props) => (
  <span
    {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    data-status-mark={mark.kind}
    data-status-state={mark.kind === 'state' ? mark.state : undefined}
    data-status-family={mark.kind === 'state' ? STATUS_MARK_DRAWING[mark.state].family : undefined}
    data-status-tone={mark.kind === 'dot' || mark.kind === 'count' ? mark.tone : undefined}
    className={cn('relative inline-flex size-4 shrink-0 items-center justify-center', className)}
  >
    {drawingOf({ mark })}
  </span>
);
