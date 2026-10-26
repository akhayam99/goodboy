import { StatusDot, cn, type Tone } from '@goodboy/ui';
import type { AgentRow } from '../agentRowOf';

type Props = {
  readonly rows: ReadonlyArray<AgentRow>;
  readonly className?: string;
};

type Line = {
  readonly tone: Tone;
  readonly isPulsing: boolean;
  readonly text: string;
};

type NamesParams = {
  readonly names: ReadonlyArray<string>;
};

const joinNames = ({ names }: NamesParams): string => {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
};

const lineOf = ({ rows }: Pick<Props, 'rows'>): Line => {
  if (rows.some((row) => row.state === 'looking')) {
    return { tone: 'info', isPulsing: true, text: 'Looking for agents on this Mac' };
  }
  const found = rows.filter((row) => row.isFound || row.state === 'ready');
  if (found.length === 0) {
    return { tone: 'neutral', isPulsing: false, text: 'No agents on this Mac yet' };
  }
  const names = joinNames({ names: found.map((row) => row.label) });
  return { tone: 'success', isPulsing: false, text: `Found ${names} on this Mac` };
};

export const DetectionLine = ({ rows, className }: Props) => {
  const line = lineOf({ rows });
  return (
    <p
      role="status"
      className={cn(
        'flex items-center justify-center gap-2 text-meta text-muted-foreground',
        className,
      )}
    >
      <StatusDot tone={line.tone} size="sm" pulsing={line.isPulsing} />
      <span key={line.text} className="motion-safe:animate-text-swap">
        {line.text}
      </span>
    </p>
  );
};
