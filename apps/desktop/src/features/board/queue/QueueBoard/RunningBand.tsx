import { Button, InteractiveRow, SectionLabel, TruncatedText } from '@goodboy/ui';
import { useNow } from '../../../../shared/hooks/useNow';
import { NAMES } from '../../../../shared/utils/names';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { AgentPeek } from './AgentPeek';
import { RunningAgentRow } from './RunningAgentRow';
import type { RunningGroup, RunningRow } from '../runningGroupsOf';

type RowParams = {
  readonly row: RunningRow;
};

type MessageParams = RowParams & {
  readonly text: string;
};

type SessionParams = {
  readonly sessionId: string;
};

type RunParams = {
  readonly runId: string;
};

type Props = {
  readonly groups: ReadonlyArray<RunningGroup>;
  readonly focusedRunId: string | null;
  readonly peekRunId: string | null;
  readonly isActive: boolean;
  readonly hasFailed: boolean;
  readonly earlierOf: (params: RunParams) => ReadonlyArray<string>;
  readonly onRetry: () => void;
  readonly onToggle: (params: RowParams) => void;
  readonly onOpenSession: (params: SessionParams) => void;
  readonly onMessage: (params: MessageParams) => void;
  readonly onClosePeek: () => void;
};

const CLOCK_MS = 15_000;
const RETRY = 'Retry';

export const RunningBand = ({
  groups,
  focusedRunId,
  peekRunId,
  isActive,
  hasFailed,
  earlierOf,
  onRetry,
  onToggle,
  onOpenSession,
  onMessage,
  onClosePeek,
}: Props) => {
  const now = useNow(CLOCK_MS, groups.length > 0);
  const count = groups.reduce((total, group) => total + group.rows.length, 0);
  const retry = actionButtonLookOf({ verb: RETRY, variant: 'secondary' });
  return (
    <section
      aria-label={NAMES.running}
      data-queue-band="running"
      data-band-active={isActive ? '' : undefined}
      className="flex min-w-0 flex-col gap-2"
    >
      <SectionLabel label={NAMES.running} headingLevel={2} count={count > 1 ? count : undefined} />
      {hasFailed ? (
        <span role="alert" className="flex min-w-0 items-center gap-2 text-meta text-foreground">
          <span className="min-w-0 truncate">{"Couldn't read the live work"}</span>
          <Button size="xs" variant={retry.variant} intent={retry.intent} onClick={onRetry}>
            {RETRY}
          </Button>
        </span>
      ) : null}
      {count === 0 && !hasFailed ? (
        <span className="text-ui text-muted-foreground">{NAMES.nothingIsRunning}</span>
      ) : null}
      {groups.map((group) => (
        <div key={group.sessionId} className="flex min-w-0 flex-col gap-1">
          <InteractiveRow
            label={group.title}
            isSelected={false}
            onOpen={() => onOpenSession({ sessionId: group.sessionId })}
            dataAttributes={{ 'data-running-session': group.sessionId }}
            className="flex min-h-7 min-w-0 items-center px-3"
          >
            <TruncatedText className="min-w-0 text-meta text-muted-foreground">
              {group.title}
            </TruncatedText>
          </InteractiveRow>
          {group.rows.map((row) => (
            <div key={row.runId} className="flex min-w-0 flex-col gap-1">
              <RunningAgentRow
                row={row}
                now={now}
                isFocused={isActive && row.runId === focusedRunId}
                isPeekOpen={row.runId === peekRunId}
                onToggle={() => onToggle({ row })}
              />
              {row.runId === peekRunId && row.agentId !== null ? (
                <AgentPeek
                  agentId={row.agentId}
                  who={row.who}
                  earlier={earlierOf({ runId: row.runId })}
                  onSend={({ text }) => onMessage({ row, text })}
                  onClose={onClosePeek}
                />
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
};
