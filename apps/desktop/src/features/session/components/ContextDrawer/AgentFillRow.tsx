import { formatTokens, Meter } from '@goodboy/ui';
import type { ContextFill } from './contextFillOf';

type Props = {
  readonly name: string;
  readonly fill: ContextFill | null;
};

export const AgentFillRow = ({ name, fill }: Props) => (
  <div data-agent-fill={name} className="flex items-center gap-3 rounded-lg px-2 py-2">
    <span className="min-w-0 flex-1 truncate">{name}</span>
    {fill === null ? (
      <span className="shrink-0 text-meta text-faint-foreground">Not reported yet</span>
    ) : (
      <>
        <Meter
          label={`${name} context window`}
          value={fill.percent}
          size="xs"
          className="w-24 shrink-0"
        />
        <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
          {`${formatTokens(fill.tokens)} of ${formatTokens(fill.window)}`}
        </span>
      </>
    )}
  </div>
);
