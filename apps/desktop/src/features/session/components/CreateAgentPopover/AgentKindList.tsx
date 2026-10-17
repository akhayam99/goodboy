import type { AgentKind } from '../../agent-kind';
import { AgentKindOption } from './AgentKindOption';

type Props = {
  readonly kinds: ReadonlyArray<AgentKind>;
  readonly value: AgentKind;
  readonly onChange: (kind: AgentKind) => void;
};

export const AgentKindList = ({ kinds, value, onChange }: Props) => (
  <div className="flex flex-col gap-1 p-1">
    {kinds.map((kind) => (
      <AgentKindOption
        key={kind}
        kind={kind}
        isActive={kind === value}
        onSelect={() => onChange(kind)}
      />
    ))}
  </div>
);
