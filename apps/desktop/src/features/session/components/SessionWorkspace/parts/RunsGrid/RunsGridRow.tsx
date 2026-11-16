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
import type { SessionRun } from '../../../../sessionRunsOf';
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

const KIND_LABEL: Readonly<Record<SessionRun['kind'], string>> = {
  preset: NAMES.runKind.workflow,
  orchestrated: NAMES.runKind.workflow,
  auto: NAMES.lead,
  agent: NAMES.runKind.agent,
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
      ariaLabel={`Open ${run.title}, ${KIND_LABEL[run.kind]}, ${run.stateWord}${run.isUnread ? ', unread' : ''}`}
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
          aria-label={KIND_LABEL[run.kind]}
          className="text-muted-foreground"
        />,
        '',
        run.isOlderRun ? (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate">{run.origin}</span>
            <span className="shrink-0 text-meta text-muted-foreground">
              {NAMES.runKind.olderRun}
            </span>
          </span>
        ) : (
          run.origin
        ),
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
