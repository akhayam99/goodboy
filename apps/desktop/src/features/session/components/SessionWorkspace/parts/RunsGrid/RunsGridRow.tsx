import { ListGridRow, StateDot, formatUsd } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { formatAge } from '../../../../../../shared/utils/time/formatAge';
import { useObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
import type { SessionRun, SessionRunShape } from '../../../../sessionRunsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly run: SessionRun;
  readonly costUsd: number | null;
  readonly now: number;
  readonly onOpen: () => void;
};

const SHAPE_ICON = {
  plan: CONCEPT_ICONS.orchestrator,
  lead: CONCEPT_ICONS.auto,
} as const;

const SHAPE_LABEL: Readonly<Record<SessionRunShape, string>> = {
  plan: 'Plan',
  lead: 'One agent',
};

type MenuAgentParams = {
  readonly run: SessionRun;
};

const menuAgentOf = ({ run }: MenuAgentParams): AgentId | null =>
  run.open.kind === 'run' ? null : run.open.agentId;

export const RunsGridRow = ({ sessionId, run, costUsd, now, onOpen }: Props) => {
  const agentId = menuAgentOf({ run });
  const menu = useObjectMenuTrigger({
    target:
      agentId === null ? { kind: 'session', sessionId } : { kind: 'agent', sessionId, agentId },
    anchorKey: `run:${run.id}`,
  });
  const Icon = SHAPE_ICON[run.shape];
  return (
    <ListGridRow
      ariaLabel={`Open ${run.title}, ${SHAPE_LABEL[run.shape]}, ${run.stateWord}`}
      onSelect={onOpen}
      {...(agentId !== null && { onContextMenu: menu.onContextMenu, onKeyDown: menu.onKeyDown })}
      cells={[
        <StateDot state={run.dot} label={run.stateWord} isLive={run.dot === 'running'} />,
        <Icon
          size={ICON_SIZE.row}
          aria-label={SHAPE_LABEL[run.shape]}
          className="text-muted-foreground"
        />,
        run.title,
        run.origin,
        run.stateWord,
        run.progress,
        costUsd === null ? '' : formatUsd(costUsd),
        run.startedAt === 0 ? '' : formatAge({ from: new Date(run.startedAt).toISOString(), now }),
      ]}
    />
  );
};
