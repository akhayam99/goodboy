import type { ImpactSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { ArrowUpRight } from 'lucide-react';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly sessions: ReadonlyArray<ImpactSession>;
  readonly valueLabel: string;
  readonly formatValue: (value: number) => string;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const SessionRows = ({ sessions, valueLabel, formatValue, onOpenSession }: Props) => {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={CONCEPT_ICONS.impact}
        tone={CONCEPT_TONE.impact}
        title="No sessions in this window"
        size="inline"
      />
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {sessions.map((session) => (
        <button
          key={session.sessionId}
          type="button"
          onClick={() => onOpenSession(session.sessionId)}
          className="flex items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60"
        >
          <span className="min-w-0 flex-1 truncate text-foreground">{session.goal}</span>
          <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
            {formatValue(session.value)} {valueLabel}
          </span>
          <ArrowUpRight size={12} aria-hidden className="shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
};
