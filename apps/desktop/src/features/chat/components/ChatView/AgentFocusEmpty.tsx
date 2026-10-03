import { cn, PANE_RHYTHM } from '@goodboy/ui';
import { AGENT_KIND_META, type AgentKind } from '../../../session/agent-kind';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';

type Props = {
  readonly kind: AgentKind;
};

export const AgentFocusEmpty = ({ kind }: Props) => {
  const meta = AGENT_KIND_META[kind];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1 px-6 py-16 text-center',
        PANE_RHYTHM.column,
      )}
    >
      <p className="flex items-center gap-2 text-body text-foreground">
        <AgentKindChip kind={kind} label={meta.noun} />
        <span>{meta.hint}.</span>
      </p>
      <p className="text-label text-faint-foreground">
        It shares the session brief with every other agent.
      </p>
    </div>
  );
};
