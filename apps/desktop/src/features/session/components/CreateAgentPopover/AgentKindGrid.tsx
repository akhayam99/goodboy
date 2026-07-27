import type { AgentKind } from '../../agent-kind';
import { AgentKindTile } from './AgentKindTile';

type Props = {
  readonly kinds: ReadonlyArray<AgentKind>;
  readonly value: AgentKind;
  readonly onChange: (kind: AgentKind) => void;
};

export const AgentKindGrid = ({ kinds, value, onChange }: Props) => (
  <div className="grid grid-cols-2 gap-1 px-2.5">
    {kinds.map((kind) => (
      <AgentKindTile
        key={kind}
        kind={kind}
        isActive={kind === value}
        onSelect={() => onChange(kind)}
      />
    ))}
  </div>
);
