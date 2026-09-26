import { Check, Minus, Shield } from 'lucide-react';
import { cn } from '../../cn';
import { WORK_NODE_GLYPH_SIZE, type WorkNodeMark, type WorkNodeState } from './workNodeSpec';

type Props = {
  readonly state: WorkNodeState;
  readonly mark: WorkNodeMark;
  readonly hasArc: boolean;
  readonly glyphSize?: number;
};

const SIGN_CLASS = 'text-2xs font-bold leading-none tabular-nums';

type SignParams = {
  readonly sign: string;
  readonly className: string;
};

const signOf = ({ sign, className }: SignParams) => (
  <span className={cn(SIGN_CLASS, className)}>{sign}</span>
);

const READY_TRIANGLE = 'M 3 1.5 L 9 5 L 3 8.5 Z';

type MarkParams = {
  readonly mark: WorkNodeMark;
  readonly tone: 'faint' | 'foreground' | 'running';
};

const markOf = ({ mark, tone }: MarkParams) => {
  if (mark.kind === 'glyph') {
    return mark.glyph;
  }
  if (mark.kind === 'index') {
    return (
      <span
        className={cn(
          'text-3xs font-semibold leading-none tabular-nums',
          tone === 'faint' ? 'text-faint-foreground' : 'text-foreground',
        )}
      >
        {mark.value}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'size-1.5 rounded-full',
        tone === 'running' && 'bg-info motion-safe:animate-soft-pulse',
        tone === 'faint' && 'bg-faint-foreground',
        tone === 'foreground' && 'bg-foreground',
      )}
    />
  );
};

export const WorkNodeCenter = ({
  state,
  mark,
  hasArc,
  glyphSize = WORK_NODE_GLYPH_SIZE,
}: Props) => {
  switch (state) {
    case 'queued':
      return markOf({ mark, tone: 'faint' });
    case 'running':
      return markOf({ mark, tone: hasArc ? 'foreground' : 'running' });
    case 'marker':
      return markOf({ mark, tone: 'foreground' });
    case 'ready':
      return (
        <svg width={10} height={10} viewBox="0 0 10 10" className="fill-warning">
          <path d={READY_TRIANGLE} />
        </svg>
      );
    case 'question':
      return signOf({ sign: '?', className: 'text-warning' });
    case 'budget':
      return signOf({ sign: '$', className: 'text-warning' });
    case 'approval':
      return <Shield size={glyphSize} strokeWidth={2.5} className="text-warning" />;
    case 'failed':
      return signOf({ sign: '!', className: 'text-danger' });
    case 'done':
      return <Check size={glyphSize} strokeWidth={2.5} className="text-success" />;
    case 'closed':
      return <Check size={glyphSize} strokeWidth={2.5} className="text-muted-foreground" />;
    case 'stopped':
      return <span className="size-1.5 rounded-xs bg-muted-foreground" />;
    case 'skipped':
      return <Minus size={glyphSize} strokeWidth={2.5} className="text-faint-foreground" />;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};
