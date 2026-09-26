import { SectionSurface, StatusDot } from '@goodboy/ui';
import type { Agent, AgentId, OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore, agentPlace } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly delegates: ReadonlyArray<Agent>;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

const TONE = {
  failed: 'danger',
  running: 'info',
  completed: 'success',
} as const;

const toneFor = ({ status }: { readonly status: Agent['status'] }) =>
  status === 'failed' || status === 'running' || status === 'completed'
    ? TONE[status]
    : ('neutral' as const);

export const AgentBriefDelegates = ({ sessionId, delegates, questions }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  if (delegates.length === 0) {
    return null;
  }
  const textOf = ({ delegate }: { readonly delegate: Agent }): string =>
    questions.find((question) => question.id === delegate.sourceThreadId)?.text ?? delegate.name;
  const onSelect = (agentId: AgentId) => {
    navigate({ to: agentPlace({ sessionId, agentId }) });
  };

  return (
    <SectionSurface
      label="Delegated answers"
      hint="Agents answering an open question on your behalf."
      action={
        <span className="text-2xs tabular-nums text-muted-foreground">
          {String(delegates.length)}
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        {delegates.map((delegate) => (
          <button
            key={delegate.id}
            type="button"
            data-testid={`delegate-brief-row-${delegate.id}`}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-elevated"
            onClick={() => onSelect(delegate.id)}
          >
            <StatusDot
              tone={toneFor({ status: delegate.status })}
              size="sm"
              pulsing={delegate.status === 'running'}
            />
            <span className="min-w-0 flex-1 truncate text-xs leading-4 text-foreground">
              {textOf({ delegate })}
            </span>
            <span className="shrink-0 text-2xs text-muted-foreground">
              {delegate.status === 'pending' ? 'queued' : delegate.status}
            </span>
          </button>
        ))}
      </div>
    </SectionSurface>
  );
};
