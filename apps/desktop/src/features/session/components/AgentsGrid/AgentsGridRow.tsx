import { useContext } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { cn, ROW_INTERACTIVE, TruncatedText } from '@goodboy/ui';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { agentKindPalette, type AgentKind } from '../../agent-kind';
import { describeAgentStatus } from '../../agent-status';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAgentHeaderRouting } from '../../../../shared/hooks/useAgentHeaderRouting';
import { providerIdOf } from '../../../../shared/utils/providerIdOf';
import { agentActiveClock } from '../../../workTreeModel/agentWorkTime';
import { WorkTimeContext } from '../../../workTreeModel/workTimeSource';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { AgentStatusIcon } from '../AgentCard/AgentStatusIcon';
import { AGENTS_GRID_COLUMNS } from './agentsGridColumns';

type Props = {
  readonly session: Session;
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly isMuted: boolean;
  readonly onOpen: () => void;
};

export const AgentsGridRow = ({ session, run, kind, isMuted, onOpen }: Props) => {
  const source = useContext(WorkTimeContext);
  const menu = useObjectMenuTrigger({
    target: { kind: 'agent', sessionId: run.sessionId, agentId: run.id },
    anchorKey: `agent:${run.id}`,
  });
  const routing = useAgentHeaderRouting({ session, agent: run });
  const provider = providerIdOf({ value: routing.provider });
  const model = routing.model === null ? null : modelLabel(routing.model, provider);
  const duration =
    source === null
      ? null
      : agentActiveClock({
          agentId: run.id,
          unit: 'turn',
          isRunning: run.status === 'running',
          source,
        });

  return (
    <li>
      <button
        type="button"
        data-agent-row={run.id}
        onClick={onOpen}
        onContextMenu={menu.onContextMenu}
        onKeyDown={menu.onKeyDown}
        className={cn(
          'grid min-h-8 w-full items-center gap-x-3 rounded-md px-2 text-left text-label',
          ROW_INTERACTIVE,
          AGENTS_GRID_COLUMNS,
          isMuted ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        <AgentKindChip kind={kind} density="glyph" isDecorative />
        <span className="truncate text-muted-foreground">{agentKindPalette({ kind }).label}</span>
        <TruncatedText tooltip={run.name}>{run.name}</TruncatedText>
        <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <AgentStatusIcon status={run.status} />
          <span className="truncate">{describeAgentStatus({ status: run.status }).label}</span>
        </span>
        <span data-agent-model className="flex min-w-0 items-center gap-2 text-muted-foreground">
          {provider === null ? null : <ProviderGlyph id={provider} size={ICON_SIZE.row} />}
          <span className="truncate">{model}</span>
        </span>
        <span className="text-right text-meta tabular-nums text-faint-foreground">{duration}</span>
      </button>
    </li>
  );
};
