import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import type { AutoGroup } from '../autoGroupOf';
import { AutoChildLine } from './AutoChildLine';
import { compactLineOf } from './compactLineOf';

type Props = {
  readonly group: AutoGroup;
  readonly isCompact: boolean;
};

export const AutoAgentGroup = ({ group, isCompact }: Props) => (
  <section
    aria-label={`Auto${group.title === null ? '' : `, ${group.title}`}`}
    data-auto-group={group.phase}
    className="flex min-w-0 flex-col gap-1"
  >
    <header className="flex min-w-0 items-center gap-2">
      <AgentKindChip kind="auto" density="glyph" isDecorative />
      <span className="shrink-0 text-label text-foreground">Auto</span>
      <span className="min-w-0 flex-1 truncate text-label text-muted-foreground">
        {isCompact ? compactLineOf({ group }) : (group.title ?? '')}
      </span>
      {isCompact ? null : (
        <span className="shrink-0 text-label text-muted-foreground">{group.word}</span>
      )}
    </header>
    {isCompact || group.children.length === 0 ? null : (
      <div className="flex min-w-0 gap-1">
        <span aria-hidden className="flex w-6 shrink-0 justify-center pb-3">
          <span className="w-px bg-border" />
        </span>
        <ul
          aria-label="Agents Auto started"
          className="flex min-w-0 flex-1 list-none flex-col gap-0.5"
        >
          {group.children.map((child) => (
            <AutoChildLine key={child.delegationId ?? child.agentId} group={group} child={child} />
          ))}
        </ul>
      </div>
    )}
  </section>
);
