import type { ReactNode } from 'react';
import { formatUsd, ICON_SIZE, ListGridRow, StateDot } from '@goodboy/ui';
import { NAMES } from '../../../../../../shared/utils/names';
import type { Session } from '@goodboy/types';
import { AgentModelLine } from '../../../../../providers/modelLine/AgentModelLine';
import type { ModelLine } from '../../../../../providers/modelLine/modelLineOf';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { formatAge } from '../../../../../../shared/utils/time/formatAge';
import { formatSpan } from '../../../../../../shared/utils/time/formatSpan';
import type { ObjectTarget } from '../../../../../actions/types';
import { useObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
import type { SessionRun, SessionRunShape } from '../../../../sessionRunsOf';
import { RunRowTitle } from './RunRowTitle';
import { RunRowVerb } from './RunRowVerb';
import { runRowAnchorKey } from './runRowAnchorKey';

type Props = {
  readonly session: Session;
  readonly run: SessionRun;
  readonly rowKey: string;
  readonly modelLine: ModelLine | null;
  readonly costUsd: number | null;
  readonly titleSuffix: ReactNode;
  readonly now: number;
  readonly isVerbBusy: boolean;
  readonly onOpen: () => void;
  readonly onVerb: () => void;
};

const SHAPE_ICON = {
  plan: CONCEPT_ICONS.orchestrator,
  lead: CONCEPT_ICONS.auto,
} as const;

const SHAPE_LABEL: Readonly<Record<SessionRunShape, string>> = {
  plan: NAMES.runKind.workflow,
  lead: NAMES.runKind.agent,
};

type MenuParams = {
  readonly run: SessionRun;
  readonly session: Session;
};

const menuTargetOf = ({ run, session }: MenuParams): ObjectTarget =>
  run.open.kind === 'run'
    ? { kind: 'runRow', sessionId: session.id, runId: run.open.runId }
    : { kind: 'agent', sessionId: session.id, agentId: run.open.agentId };

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
  session,
  run,
  rowKey,
  modelLine,
  costUsd,
  titleSuffix,
  now,
  isVerbBusy,
  onOpen,
  onVerb,
}: Props) => {
  const menu = useObjectMenuTrigger({
    target: menuTargetOf({ run, session }),
    anchorKey: runRowAnchorKey({ rowKey }),
  });
  const Icon = SHAPE_ICON[run.shape];
  return (
    <ListGridRow
      ariaLabel={`Open ${run.title}, ${SHAPE_LABEL[run.shape]}, ${run.stateWord}${run.isUnread ? ', unread' : ''}`}
      onSelect={onOpen}
      rowKey={rowKey}
      overlays={[
        {
          column: 'title',
          node: (
            <RunRowTitle
              sessionId={session.id}
              run={run}
              rowKey={rowKey}
              suffix={titleSuffix}
              onOpen={onOpen}
            />
          ),
        },
        {
          column: 'verb',
          node:
            run.verb === null ? null : (
              <RunRowVerb session={session} verb={run.verb} isBusy={isVerbBusy} onPress={onVerb} />
            ),
        },
      ]}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      cells={[
        <StateDot state={run.dot} label={run.stateWord} isLive={run.dot === 'running'} />,
        <Icon
          size={ICON_SIZE.row}
          aria-label={SHAPE_LABEL[run.shape]}
          className="text-muted-foreground"
        />,
        '',
        run.origin,
        modelLine === null ? '' : <AgentModelLine line={modelLine} />,
        run.stateWord,
        run.progress,
        costUsd === null ? '' : formatUsd(costUsd),
        timeCellOf({ run, now }),
        run.verb === null ? '' : <span aria-hidden />,
      ]}
    />
  );
};
