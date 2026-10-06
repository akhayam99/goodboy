import { AGENT_KIND_META, type AgentKind } from '../../../session/agent-kind';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';

type Props = {
  readonly kind: AgentKind;
};

export const AgentFocusEmpty = ({ kind }: Props) => {
  const meta = AGENT_KIND_META[kind];

  return (
    <div className="flex w-full flex-col items-center justify-center gap-1 px-6 py-16 text-center">
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
