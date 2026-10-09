import { useState } from 'react';
import { EmptyLine, Button, formatUsd } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import type { AgentSpend } from '../../sessionSpendByAgent';

const AGENT_SPEND_VISIBLE = 6;

type Props = {
  readonly agents: ReadonlyArray<AgentSpend>;
};

export const AgentSpendList = ({ agents }: Props) => {
  const [isAllShown, setIsAllShown] = useState(false);
  const top = agents.reduce((max, agent) => Math.max(max, agent.costUsd), 0);
  const visible = isAllShown ? agents : agents.slice(0, AGENT_SPEND_VISIBLE);

  return (
    <section aria-label="By agent" className="flex flex-col gap-2">
      <span className="text-row text-foreground">By agent</span>
      {agents.length === 0 ? (
        <EmptyLine className="text-meta text-muted-foreground">
          No agent has spent anything yet.
        </EmptyLine>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((agent) => (
            <li key={agent.key} className="flex flex-col gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <AgentKindChip kind={agent.kind} />
                <span className="min-w-0 truncate text-body text-foreground">{agent.name}</span>
                <span className="min-w-0 flex-1 truncate text-meta text-faint-foreground">
                  {agent.model}
                </span>
                <span className="shrink-0 text-meta tabular-nums text-foreground">
                  {formatUsd(agent.costUsd)}
                </span>
              </div>
              <div aria-hidden className="h-0.5 w-full overflow-hidden rounded-full bg-fill">
                <div
                  className="h-full rounded-full bg-border-strong"
                  style={{ width: `${top > 0 ? (agent.costUsd / top) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {agents.length > AGENT_SPEND_VISIBLE && !isAllShown ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setIsAllShown(true)}
        >
          {`Show all ${agents.length}`}
        </Button>
      ) : null}
    </section>
  );
};
