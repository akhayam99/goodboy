import { useCallback, useMemo } from 'react';
import { ScrollFade } from '@goodboy/ui';
import {
  brandId,
  type AgentId,
  type Session,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import type { QueueMove } from '../needsYouOf';
import { runningGroupsOf } from '../runningGroupsOf';
import { NeedsYouBand } from './NeedsYouBand';
import { ReadyBand } from './ReadyBand';
import { RunningBand } from './RunningBand';
import { useAgentNouns } from './useAgentNouns';
import { useBoardPage } from './useBoardPage';
import { useFleetWork } from './useFleetWork';
import { useMergeTrain } from './useMergeTrain';
import { useQueueActions } from './useQueueActions';
import { useQueueFocus } from './useQueueFocus';
import { useQueueModel } from './useQueueModel';
import { useQueueNavigation } from './useQueueNavigation';
import { useQueueSends } from './useQueueSends';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

type MoveParams = {
  readonly move: QueueMove;
};

const AGE_MS = 30_000;

export const QueueBoard = ({ workspaceId, sessions }: Props) => {
  const model = useQueueModel({ workspaceId, sessions });
  const fleet = useFleetWork({ sessionTitles: model.sessionTitles });
  const actions = useQueueActions();
  const nav = useQueueNavigation();
  const page = useBoardPage();
  const showAll = useQueueSends((state) => state.showAll);
  const now = useNow(AGE_MS);
  const nounById = useAgentNouns({ work: fleet.work, sessions: model.sessions });
  const groups = useMemo(
    () =>
      runningGroupsOf({
        work: fleet.work,
        sessionTitles: model.sessionTitles,
        nounById,
        pending: model.pending,
      }),
    [fleet.work, model.pending, model.sessionTitles, nounById],
  );
  const runningRows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  const { moves } = model.needsYou;
  const train = useMergeTrain({ ready: model.ready, sessionTitles: model.sessionTitles });
  const focus = useQueueFocus({
    moves,
    focusedMoveId: page.focusedMoveId,
    runningRows,
    ready: train.lines,
    onFocusMove: page.setFocusedMove,
    onMark: train.toggleMark,
    onMergeTrain: train.start,
    actions,
    nav,
  });

  const kickerOf = useCallback(
    ({ move }: MoveParams) => {
      const title = model.sessionTitles.get(move.sessionId) ?? '';
      const age = formatSpan({ from: move.since, to: now });
      return age === '' ? title : `${title} · ${age}`;
    },
    [model.sessionTitles, now],
  );

  return (
    <ScrollFade className="min-h-0 flex-1">
      <div
        data-queue=""
        data-active-band={focus.band}
        onKeyDown={(event) => focus.handleKey({ event })}
        onFocus={(event) => focus.syncBand({ target: event.target })}
        className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <NeedsYouBand
            moves={moves}
            focusedId={focus.focusedMove?.id ?? null}
            notNowCount={model.needsYou.notNowCount}
            isActive={focus.band === 'needs-you'}
            kickerOf={kickerOf}
            onFocus={({ move }) => {
              focus.activateBand({ band: 'needs-you' });
              page.setFocusedMove({ moveId: move.id });
            }}
            onAnswer={actions.answer}
            onOpenPage={nav.openPage}
            onOpenSession={nav.openLanding}
            onNotNow={actions.notNow}
            onShowHidden={() => showAll({ moveIds: model.needsYou.notNowIds })}
          />
          <ReadyBand
            lines={train.lines}
            focusedId={focus.focusedReady?.sessionId ?? null}
            isActive={focus.band === 'ready'}
            marked={train.marked}
            train={train.train}
            method={train.method}
            onOpen={nav.openReady}
            onToggleMark={train.toggleMark}
            onStart={train.start}
            onStop={train.stop}
            onDismiss={train.dismiss}
          />
        </div>
        <RunningBand
          groups={groups}
          focusedRunId={focus.focusedRow?.runId ?? null}
          peekRunId={focus.peekRunId}
          isActive={focus.band === 'running'}
          hasFailed={fleet.hasFailed}
          earlierOf={fleet.earlierOf}
          onRetry={fleet.retry}
          onToggle={focus.togglePeek}
          onOpenSession={nav.openSession}
          onClosePeek={focus.closePeek}
          onMessage={({ row, text }) => {
            if (row.agentId === null) {
              return;
            }
            actions.message({
              sessionId: brandId<SessionId>({ value: row.sessionId }),
              agentId: brandId<AgentId>({ value: row.agentId }),
              text,
            });
          }}
        />
      </div>
    </ScrollFade>
  );
};
