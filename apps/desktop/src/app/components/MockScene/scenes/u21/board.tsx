import { useEffect, useState, type ComponentType } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { IsoDateTime, Session, SessionId } from '@goodboy/types';
import { StageBoard } from '../../../../../features/workspace/components/StageBoard';
import { useAppStore, useSessions } from '../../../../../store';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';

const STACKED_WIDTH = 1200;
const WIDE_WIDTH = 2560;

const DAY = 86_400_000;

const MORE_DONE_GOALS = [
  'Add a retry budget to the export worker',
  'Tighten the refund webhook signature check',
  'Move the ledger snapshot job off the primary',
  'Trim the settlement export columns',
];

const MORE_ARCHIVED_GOALS = [
  'Pin the FX rates provider timeout',
  'Document the payout hold flow',
  'Drop the unused Acme sandbox keys',
];

const isoAgo = ({ ms }: { readonly ms: number }): IsoDateTime =>
  new Date(Date.now() - ms).toISOString() as IsoDateTime;

const isSettled = (id: SessionId): boolean => {
  const pr = useAppStore.getState().sessionGithub[id]?.pr ?? null;
  return pr !== null && (pr.state === 'merged' || pr.state === 'closed');
};

const seedEmptyLanes = (): void => {
  seedBoardScene();
  const state = useAppStore.getState();
  const asking = new Set(
    Object.entries(state.sessionOpenQuestions)
      .filter(([, questions]) => questions.length > 0)
      .map(([id]) => id),
  );
  useAppStore.setState({
    sessions: state.sessions.filter(
      (session) => !asking.has(session.id) && !isSettled(session.id as SessionId),
    ),
    archivedSessions: { [WORKSPACE_ID]: [] },
  });
};

type CloneParams = {
  readonly source: Session;
  readonly index: number;
  readonly goal: string;
  readonly isArchived: boolean;
};

const cloneOf = ({ source, index, goal, isArchived }: CloneParams): Session => {
  const at = isoAgo({ ms: (index + 5) * DAY });
  return {
    ...source,
    id: `mock-board-more-${isArchived ? 'archived' : 'done'}-${index}` as SessionId,
    goal,
    createdAt: at,
    updatedAt: at,
    ...(isArchived ? { archivedAt: at } : {}),
  };
};

const seedBusyLanes = (): void => {
  seedBoardScene();
  const state = useAppStore.getState();
  const settled = state.sessions.filter((session) => isSettled(session.id as SessionId));
  const doneSource = settled[0];
  const archivedSource = (state.archivedSessions[WORKSPACE_ID] ?? [])[0];
  if (doneSource === undefined || archivedSource === undefined) {
    return;
  }
  const moreDone = MORE_DONE_GOALS.map((goal, index) =>
    cloneOf({ source: doneSource, index, goal, isArchived: false }),
  );
  const moreArchived = MORE_ARCHIVED_GOALS.map((goal, index) =>
    cloneOf({ source: archivedSource, index, goal, isArchived: true }),
  );
  const githubOfDone = state.sessionGithub[doneSource.id];
  useAppStore.setState({
    sessions: [...state.sessions, ...moreDone],
    archivedSessions: {
      [WORKSPACE_ID]: [...(state.archivedSessions[WORKSPACE_ID] ?? []), ...moreArchived],
    },
    sessionProjectMounts: {
      ...state.sessionProjectMounts,
      ...Object.fromEntries(
        [...moreDone, ...moreArchived].map((session) => [
          session.id,
          state.sessionProjectMounts[doneSource.id] ?? [],
        ]),
      ),
    },
    sessionGithub:
      githubOfDone === undefined
        ? state.sessionGithub
        : {
            ...state.sessionGithub,
            ...Object.fromEntries(moreDone.map((session) => [session.id, githubOfDone])),
          },
  });
};

type FrameWidth = number | '100%';

type SceneProps = {
  readonly seed: () => void;
  readonly width: FrameWidth;
};

const BoardWidthScene = ({ seed, width }: SceneProps) => {
  const [isReady, setIsReady] = useState(false);
  const sessions = useSessions();

  useEffect(() => {
    seed();
    setIsReady(true);
  }, [seed]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen bg-background text-foreground">
      <ScrollFade orientation="horizontal" fadeSize="w-8" className="h-full">
        <div style={{ width }} className="h-full" data-testid="board-scene-frame">
          <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} />
        </div>
      </ScrollFade>
    </main>
  );
};

export const U21_BOARD_SCENES: Readonly<Record<string, ComponentType>> = {
  'board-empty-lanes': () => <BoardWidthScene seed={seedEmptyLanes} width="100%" />,
  'board-stacked': () => <BoardWidthScene seed={seedBusyLanes} width={STACKED_WIDTH} />,
  'board-wide': () => <BoardWidthScene seed={seedBusyLanes} width={WIDE_WIDTH} />,
};
