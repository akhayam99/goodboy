import { cn } from '@goodboy/ui';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import {
  HISTORY_ACTION_LABEL,
  HISTORY_ACTION_TERM,
  type HistoryRowAction,
} from '../../historyRowMarks';

type Props = {
  readonly isDone: boolean;
};

const ACTIONS: ReadonlyArray<HistoryRowAction> = [
  'pick',
  'fixup',
  'squash',
  'move',
  'reword',
  'drop',
];

const legendLine = ({
  label,
  isDashed,
  stroke,
}: {
  readonly label: string;
  readonly isDashed: boolean;
  readonly stroke: string;
}) => (
  <span className="inline-flex items-center gap-2">
    <svg aria-hidden width={24} height={10}>
      <line
        x1={0}
        y1={5}
        x2={24}
        y2={5}
        strokeWidth={2}
        strokeDasharray={isDashed ? '4 4' : undefined}
        className={stroke}
      />
    </svg>
    {label}
  </span>
);

export const HistoryLegend = ({ isDone }: Props) => (
  <div
    aria-label="Legend"
    role="group"
    className="flex flex-wrap items-center gap-x-4 gap-y-2 text-label text-muted-foreground"
  >
    {legendLine({ label: 'main', isDashed: false, stroke: 'stroke-idle' })}
    {legendLine({
      label: isDone ? 'your branch' : 'your branch now',
      isDashed: false,
      stroke: 'stroke-muted-foreground',
    })}
    {isDone ? null : (
      <>
        {legendLine({ label: 'after Apply', isDashed: true, stroke: 'stroke-muted-foreground' })}
        <span aria-hidden className="h-3.5 w-px bg-border-soft" />
        {ACTIONS.map((action) => (
          <span key={action} className="inline-flex items-center gap-2">
            <svg aria-hidden width={16} height={16}>
              <circle
                cx={8}
                cy={8}
                r={6}
                strokeWidth={2}
                strokeDasharray={action === 'drop' ? '3 2.4' : undefined}
                className={cn('fill-background', HISTORY_ACTION_CLASSES[action].stroke)}
              />
              {action === 'drop' ? null : (
                <circle cx={8} cy={8} r={2.4} className={HISTORY_ACTION_CLASSES[action].fill} />
              )}
            </svg>
            {HISTORY_ACTION_LABEL[action]}
            <span className="font-mono text-meta text-faint-foreground">
              {HISTORY_ACTION_TERM[action]}
            </span>
          </span>
        ))}
      </>
    )}
  </div>
);
