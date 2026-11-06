import type { ReactNode } from 'react';
import {
  formatUsd,
  ICON_SIZE,
  ListGridRow,
  StateDot,
  TruncatedText,
  UNREAD_TITLE,
  cn,
} from '@goodboy/ui';
import { NAMES } from '../../../../../../shared/utils/names';
import type { AgentId, SessionId } from '@goodboy/types';
import { AgentModelLine } from '../../../../../providers/modelLine/AgentModelLine';
import type { ModelLine } from '../../../../../providers/modelLine/modelLineOf';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { formatAge } from '../../../../../../shared/utils/time/formatAge';
import { formatSpan } from '../../../../../../shared/utils/time/formatSpan';
import { useObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
import type { SessionRun, SessionRunShape } from '../../../../sessionRunsOf';
import { RunRowVerb } from './RunRowVerb';

type Props = {
  readonly sessionId: SessionId;
  readonly run: SessionRun;
  readonly rowKey: string;
  readonly modelLine: ModelLine | null;
  readonly costUsd: number | null;
  readonly titleSuffix: ReactNode;
  readonly now: number;
  readonly onOpen: () => void;
};

const SHAPE_ICON = {
  plan: CONCEPT_ICONS.orchestrator,
  lead: CONCEPT_ICONS.auto,
} as const;

const SHAPE_LABEL: Readonly<Record<SessionRunShape, string>> = {
  plan: NAMES.runKind.workflow,
  lead: NAMES.runKind.agent,
};

type MenuAgentParams = {
  readonly run: SessionRun;
};

const menuAgentOf = ({ run }: MenuAgentParams): AgentId | null =>
  run.open.kind === 'run' ? null : run.open.agentId;

type TimeParams = {
  readonly run: SessionRun;
  readonly now: number;
};

const timeCellOf = ({ run, now }: TimeParams): string => {
  if (run.revisingSince !== null) {
    return formatSpan({ from: run.revisingSince, to: now });
  }
  return run.startedAt === 0 ? '' : formatAge({ from: new Date(run.startedAt).toISOString(), now });
};

export const RunsGridRow = ({
  sessionId,
  run,
  rowKey,
  modelLine,
  costUsd,
  titleSuffix,
  now,
  onOpen,
}: Props) => {
  const agentId = menuAgentOf({ run });
  const menu = useObjectMenuTrigger({
    target:
      agentId === null ? { kind: 'session', sessionId } : { kind: 'agent', sessionId, agentId },
    anchorKey: `run:${run.id}`,
  });
  const Icon = SHAPE_ICON[run.shape];
  return (
    <ListGridRow
      ariaLabel={`Open ${run.title}, ${SHAPE_LABEL[run.shape]}, ${run.stateWord}${run.isUnread ? ', unread' : ''}`}
      onSelect={onOpen}
      rowKey={rowKey}
      aside={run.verb === null ? undefined : <RunRowVerb sessionId={sessionId} verb={run.verb} />}
      {...(agentId !== null && { onContextMenu: menu.onContextMenu, onKeyDown: menu.onKeyDown })}
      cells={[
        <StateDot state={run.dot} label={run.stateWord} isLive={run.dot === 'running'} />,
        <Icon
          size={ICON_SIZE.row}
          aria-label={SHAPE_LABEL[run.shape]}
          className="text-muted-foreground"
        />,
        <>
          <TruncatedText className={cn('min-w-0 shrink', run.isUnread && UNREAD_TITLE)}>
            {run.title}
          </TruncatedText>
          {titleSuffix}
        </>,
        run.origin,
        modelLine === null ? '' : <AgentModelLine line={modelLine} />,
        run.stateWord,
        run.progress,
        costUsd === null ? '' : formatUsd(costUsd),
        timeCellOf({ run, now }),
      ]}
    />
  );
};
