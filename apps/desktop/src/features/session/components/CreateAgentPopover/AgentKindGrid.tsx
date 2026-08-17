import { AGENT_KIND_META, type AgentKind } from '../../agent-kind';
import { AgentKindTile } from './AgentKindTile';

type Props = {
  readonly kinds: ReadonlyArray<AgentKind>;
  readonly value: AgentKind;
  readonly onChange: (kind: AgentKind) => void;
};

export const AgentKindGrid = ({ kinds, value, onChange }: Props) => (
  <div className="flex flex-col gap-2 px-2.5">
    <div className="grid grid-cols-3 gap-1">
      {kinds.map((kind) => (
        <AgentKindTile
          key={kind}
          kind={kind}
          isActive={kind === value}
          onSelect={() => onChange(kind)}
        />
      ))}
    </div>
    <p className="truncate text-2xs text-muted-foreground" aria-live="polite">
      {AGENT_KIND_META[value].hint}
    </p>
  </div>
);
