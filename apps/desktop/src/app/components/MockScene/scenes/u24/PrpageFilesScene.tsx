import { useEffect, useState } from 'react';
import { UnderTrailContext } from '@goodboy/ui';
import type { DiffComment, PrComment, ResolveQueueItemWithThread } from '@goodboy/types';
import type { BranchTab } from '../../../../../store/slices/navigation/types';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { TrailBar } from '../../../../../features/session/components/SessionWorkspace/parts/TrailBar';
import { AskTrailButton } from '../../../../../features/session/ask/components/AskTrailButton';
import { StudioBandContext } from '../../../../../shared/components/StudioShell/studioBandContext';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { SESSION, SESSION_ID, buildItem, buildThread } from '../resolveSeed';
import { noteRow } from '../resolveGitlabSeed';
import { PR_PAGE_WORKTREE, applyPrPageSeed } from '../u23/prPageSeed';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });

const NOTE_BODIES: ReadonlyArray<readonly [string, number, string]> = [
  ['src/ledger/postCredit.ts', 14, 'Return the prior credit instead of posting a second one.'],
  ['src/webhooks/applyWebhook.ts', 8, 'Log the duplicate once, at info, with the event id.'],
];

const HOST_THREADS: ReadonlyArray<{
  readonly threadId: string;
  readonly path: string;
  readonly line: number;
  readonly author: string;
  readonly body: string;
  readonly reply: string | null;
}> = [
  {
    threadId: 'PRRT_files_credit',
    path: 'src/ledger/postCredit.ts',
    line: 18,
    author: 'priya-n',
    body: 'This adds a line to every row. Is that intended?',
    reply: 'Yes, the credit note needs the extra line.',
  },
  {
    threadId: 'PRRT_files_webhook',
    path: 'src/webhooks/applyWebhook.ts',
    line: 12,
    author: 'omar-t',
    body: 'Keep the seen-event read off the hot path.',
    reply: null,
  },
];

export type FilesSceneVariant = 'both' | 'nopr-notes' | 'split' | 'comments';

type Props = {
  readonly variant: FilesSceneVariant;
  readonly stageWidth?: number;
};

type NotesParams = {
  readonly projectId: DiffComment['projectId'];
  readonly branch: string;
};

const notesOf = ({ projectId, branch }: NotesParams): ReadonlyArray<DiffComment> =>
  NOTE_BODIES.map(([filePath, line, body], index) => ({
    id: `mock-u24-files-note-${index}`,
    sessionId: SESSION_ID,
    filePath,
    body,
    status: 'open',
    createdAt: clock.iso({
      at: index === 0 ? '2026-10-10T08:40:00.000Z' : '2026-10-10T08:20:00.000Z',
    }),
    anchor: { side: 'new', lineNumber: line },
    authorKind: 'user',
    ...(projectId !== undefined && { projectId }),
    branch,
  }));

const hostComments = (): ReadonlyArray<PrComment> =>
  HOST_THREADS.flatMap((thread) => {
    const head: PrComment = {
      id: `c-${thread.threadId}`,
      author: thread.author,
      authorAvatarUrl: null,
      body: thread.body,
      createdAt: clock.iso({ at: '2026-10-10T07:50:00.000Z' }),
      url: `https://github.com/harborline/payments-api/pull/318#${thread.threadId}`,
      source: 'review',
      path: thread.path,
      line: thread.line,
      resolved: false,
      outdated: false,
      threadId: thread.threadId,
      canResolve: true,
    };
    if (thread.reply === null) {
      return [head];
    }
    return [
      head,
      {
        ...head,
        id: `r-${thread.threadId}`,
        author: 'maya-o',
        body: thread.reply,
        createdAt: clock.iso({ at: '2026-10-10T08:05:00.000Z' }),
      },
    ];
  });

const hostRows = (): ReadonlyArray<ResolveQueueItemWithThread> =>
  HOST_THREADS.map((entry) => ({
    thread: buildThread({
      threadId: entry.threadId,
      state: 'open',
      stage: 'new',
      revision: 0,
      activeAttemptId: null,
      disposition: null,
      replyDraft: null,
      question: null,
      createdMinutesAgo: 80,
    }),
    item: buildItem({
      id: `mock-u24-files-item-${entry.threadId}`,
      threadId: entry.threadId,
      approvalState: 'none',
      approvedRevision: null,
      deferredAt: null,
      deliveredAt: null,
      candidateRevision: 0,
      createdMinutesAgo: 80,
    }),
  }));

type TabParams = {
  readonly variant: FilesSceneVariant;
};

const tabOf = ({ variant }: TabParams): BranchTab =>
  variant === 'comments' ? 'comments' : 'files';

export const PrpageFilesScene = ({ variant, stageWidth }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const hasPullRequest = variant !== 'nopr-notes';
    if (variant === 'split') {
      window.localStorage.setItem(STORAGE_KEYS.diffLayoutMode, 'split');
    }
    applyPrPageSeed({ variant: hasPullRequest ? 'github' : 'none' });
    const state = useAppStore.getState();
    const mount = state.sessionProjectMounts[SESSION_ID]?.[0];
    if (mount === undefined) {
      throw new Error('the seed has no mount');
    }
    const notes = notesOf({ projectId: mount.projectId, branch: mount.branch });
    const comments = hasPullRequest ? hostComments() : [];
    const github = state.sessionGithub[SESSION_ID];
    const mountGithub = state.mountGithub[mount.mountId];
    useAppStore.setState({
      branchTab: { [SESSION_ID]: tabOf({ variant }) },
      diffComments: { [SESSION_ID]: notes },
      sessionResolveQueueItems: {
        [SESSION_ID]: [
          ...notes.map((note) => noteRow({ note })),
          ...(hasPullRequest ? hostRows() : []),
        ],
      },
      loadDiffComments: async () => undefined,
      loadResolveSession: async () => undefined,
      ...(github?.detail != null && {
        sessionGithub: {
          ...state.sessionGithub,
          [SESSION_ID]: { ...github, detail: { ...github.detail, comments } },
        },
      }),
      ...(mountGithub?.detail != null && {
        mountGithub: {
          ...state.mountGithub,
          [mount.mountId]: { ...mountGithub, detail: { ...mountGithub.detail, comments } },
        },
      }),
    });
    setIsReady(true);
    return () => window.localStorage.removeItem(STORAGE_KEYS.diffLayoutMode);
  }, [variant]);

  if (!isReady) {
    return null;
  }

  return (
    <main
      className="h-screen overflow-hidden bg-background text-foreground"
      style={stageWidth === undefined ? undefined : { width: stageWidth }}
    >
      <UnderTrailContext.Provider value>
        <StudioBandContext.Provider
          value={<TrailBar session={SESSION} end={<AskTrailButton sessionId={SESSION_ID} />} />}
        >
          <BranchPage session={SESSION} workingDir={PR_PAGE_WORKTREE} />
        </StudioBandContext.Provider>
      </UnderTrailContext.Provider>
    </main>
  );
};
