import { useMemo } from 'react';
import { cn, ROW_INTERACTIVE, TruncatedText, WorkNode } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';
import { useTranscript } from '../../../../store';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import type { RailRow } from '../../../auto/chat/railRowsOf';
import { agentHeadingOf } from '../AgentDetailPane/agentHeadingOf';
import { briefLineOf } from '../AgentDetailPane/briefLineOf';
import { AUTO_TREE_GRID_COLUMNS } from './autoTreeGridColumns';

type Props = {
  readonly agent: Agent;
  readonly row: RailRow;
  readonly onOpen: () => void;
};

export const AutoTreeRow = ({ agent, row, onOpen }: Props) => {
  const events = useTranscript(agent.id);
  const title = useMemo(
    () => agentHeadingOf({ name: agent.name, kind: 'auto', brief: briefLineOf({ events }) }),
    [agent.name, events],
  );
  return (
    <li>
      <button
        type="button"
        data-auto-tree-row={agent.id}
        onClick={onOpen}
        className={cn(
          'grid min-h-8 w-full items-center gap-x-3 rounded-md px-2 text-left text-label text-foreground',
          ROW_INTERACTIVE,
          AUTO_TREE_GRID_COLUMNS,
        )}
      >
        <AgentKindChip kind="auto" density="glyph" isDecorative />
        <TruncatedText tooltip={title}>{title}</TruncatedText>
        <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <WorkNode size="sm" state={row.node} label={row.word} mark={{ kind: 'dot' }} />
          <span className="truncate">{row.word}</span>
        </span>
        <span className="min-w-0">
          <RoutingLabel provider={row.provider} model={row.model} muted />
        </span>
        <span className="text-right">
          <DelegationClock
            startedAtMs={row.startedAtMs}
            endedAtMs={row.endedAtMs}
            isLive={row.isLive}
          />
        </span>
      </button>
    </li>
  );
};
