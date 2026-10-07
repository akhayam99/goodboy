import { Copy, GitBranch, Link, Link2, Pencil, Pin, PinOff } from 'lucide-react';
import type { Session, SessionId, SessionProjectMount, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { openInConfiguredEditor } from '../../../shared/lib/editorSettings';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { sessionTitle } from '../../session/sessionTitle';
import { archiveSessions, restoreSessions } from '../../session/sessionArchive';
import { createAgentEventName } from '../../session/createAgentEventName';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import { RENAME_REQUEST_EVENT, requestRename } from '../renameRequest';
import { ALL_CHOICES_ID } from '../types';
import type {
  ActionChoice,
  ActionConfirm,
  ActionDefinition,
  ActionEnv,
  ObjectKindDefinition,
  SessionActionTarget,
} from '../types';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';

export type SessionFacts = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly title: string;
  readonly isArchived: boolean;
  readonly isPinned: boolean;
  readonly isBranchless: boolean;
  readonly hasMount: boolean;
  readonly branch: string | null;
  readonly worktreePath: string | null;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly worktreePaths: ReadonlyArray<string>;
  readonly prUrl: string | null;
};

type SessionWorktree = {
  readonly id: string;
  readonly name: string;
  readonly branch: string | null;
  readonly path: string;
};

const LINK_ISSUE_EVENT = 'goodboy:link-issue';

export const linkIssueEventName = ({ sessionId }: { readonly sessionId: SessionId }): string =>
  `${LINK_ISSUE_EVENT}:${sessionId}`;

export const sessionObjectKey = ({ sessionId }: { readonly sessionId: SessionId }): string =>
  `session:${sessionId}`;

export const SESSION_HEADER_ANCHOR = 'session-header';

const NO_MOUNT_REASON = 'Add a project to this session first';

const NO_WORKTREE_REASON = 'This session has no worktree yet';

const BRANCHLESS_DELETE =
  'Frees the transcript, file versions and images. Cost and shipped work stay in Impact. This cannot be undone.';

const BRANCHED_DELETE =
  'Frees the transcript, file versions and images. Cost and shipped work stay in Impact. The branch and its commits stay in the repository, and a worktree still holding uncommitted work is kept and listed under Settings, Storage. This cannot be undone.';

type OpenLensParams = {
  readonly env: ActionEnv;
  readonly sessionId: SessionId;
  readonly lens: 'review' | 'files' | 'terminal' | 'agents' | null;
};

const openLens = ({ env, sessionId, lens }: OpenLensParams): void => {
  const state = env.getState();
  state.navigate({ to: lensPlace({ state, sessionId, lens }) });
};

type LifecycleParams = {
  readonly env: ActionEnv;
  readonly session: Session;
};

const lifecyclePorts = ({ env }: { readonly env: ActionEnv }) => ({
  bulkArchiveTask: env.getState().bulkArchiveTask,
  bulkUnarchiveTask: env.getState().bulkUnarchiveTask,
  showToast: env.showToast,
});

const archive = ({ env, session }: LifecycleParams): Promise<void> =>
  archiveSessions({ sessions: [session], ...lifecyclePorts({ env }) });

const restore = ({ env, session }: LifecycleParams): Promise<void> =>
  restoreSessions({ sessions: [session], ...lifecyclePorts({ env }) });

const deleteConfirm = ({ facts }: { readonly facts: SessionFacts }): ActionConfirm => ({
  title: 'Delete session?',
  description: facts.isBranchless ? BRANCHLESS_DELETE : BRANCHED_DELETE,
  confirmLabel: 'Delete',
  role: 'danger',
  ...(!facts.isArchived && { altActionId: 'session.archive' }),
});

const isLive = ({ facts }: { readonly facts: SessionFacts }): boolean => !facts.isArchived;

const worktreesOf = ({
  facts,
}: {
  readonly facts: SessionFacts;
}): ReadonlyArray<SessionWorktree> => {
  const mounted = facts.mounts
    .filter((mount) => mount.worktreePath !== '')
    .map((mount) => ({
      id: mount.mountId,
      name: mount.mountName,
      branch: mount.branch === '' ? null : mount.branch,
      path: mount.worktreePath,
    }));
  if (mounted.length > 0) {
    return mounted;
  }
  return facts.worktreePaths.map((path) => ({
    id: path,
    name:
      path
        .split('/')
        .filter((part) => part !== '')
        .at(-1) ?? path,
    branch: null,
    path,
  }));
};

const worktreeChoices = ({
  facts,
}: {
  readonly facts: SessionFacts;
}): ReadonlyArray<ActionChoice> => {
  const worktrees = worktreesOf({ facts });
  return worktrees.length < 2
    ? []
    : [
        ...worktrees.map((worktree) => ({
          id: worktree.id,
          label: worktree.name,
          isCurrent: false,
          detail:
            worktree.branch === null ? worktree.path : `${worktree.branch} · ${worktree.path}`,
          keywords: worktree.branch === null ? [worktree.path] : [worktree.branch, worktree.path],
        })),
        {
          id: ALL_CHOICES_ID,
          label: 'Copy all paths',
          isCurrent: false,
          detail: 'One per line',
        },
      ];
};

const worktreeTextFor = ({
  facts,
  choice,
}: {
  readonly facts: SessionFacts;
  readonly choice: string | null;
}): string | null => {
  const worktrees = worktreesOf({ facts });
  if (choice === ALL_CHOICES_ID) {
    return worktrees.map((worktree) => worktree.path).join('\n');
  }
  if (choice === null) {
    return worktrees[0]?.path ?? null;
  }
  return worktrees.find((worktree) => worktree.id === choice)?.path ?? null;
};

const SESSION_ACTIONS: ReadonlyArray<ActionDefinition<SessionFacts>> = [
  {
    id: 'session.open',
    label: 'Open',
    icon: CONCEPT_ICONS.sessions,
    group: 'open',
    when: () => true,
    run: ({ facts, env }) => openLens({ env, sessionId: facts.sessionId, lens: null }),
  },
  {
    id: 'session.review',
    label: 'Review',
    icon: CONCEPT_ICONS.review,
    group: 'open',
    shortcut: 'lens.review',
    when: isLive,
    run: ({ facts, env }) => openLens({ env, sessionId: facts.sessionId, lens: 'review' }),
  },
  {
    id: 'session.diff',
    label: 'Diff',
    icon: CONCEPT_ICONS.diff,
    group: 'open',
    shortcut: 'lens.files',
    when: isLive,
    blockedReason: ({ facts }) => (facts.hasMount ? null : NO_MOUNT_REASON),
    run: ({ facts, env }) => openLens({ env, sessionId: facts.sessionId, lens: 'files' }),
  },
  {
    id: 'session.terminal',
    label: 'Terminal',
    icon: CONCEPT_ICONS.terminal,
    group: 'open',
    shortcut: 'lens.terminal',
    when: isLive,
    run: ({ facts, env }) => openLens({ env, sessionId: facts.sessionId, lens: 'terminal' }),
  },
  {
    id: 'session.editor',
    label: 'Open in editor',
    icon: CONCEPT_ICONS.editor,
    group: 'open',
    when: isLive,
    blockedReason: ({ facts }) => (facts.worktreePath === null ? NO_WORKTREE_REASON : null),
    run: ({ facts, env }) => {
      if (facts.worktreePath !== null) {
        void openInConfiguredEditor({ path: facts.worktreePath, state: env.getState() });
      }
    },
  },
  {
    id: 'session.rename',
    label: 'Rename',
    icon: Pencil,
    group: 'act',
    when: isLive,
    run: ({ facts, env }) => {
      const objectKey = sessionObjectKey({ sessionId: facts.sessionId });
      if (requestRename({ objectKey, anchorKey: env.anchorKey })) {
        return;
      }
      openLens({ env, sessionId: facts.sessionId, lens: null });
      dispatchAfterNavigation({
        name: RENAME_REQUEST_EVENT,
        detail: { objectKey, anchorKey: SESSION_HEADER_ANCHOR },
      });
    },
  },
  {
    id: 'session.pin',
    label: 'Pin session',
    icon: Pin,
    group: 'act',
    when: ({ facts }) => isLive({ facts }) && !facts.isPinned,
    run: ({ facts, env }) => env.getState().pinSession(facts.sessionId),
  },
  {
    id: 'session.unpin',
    label: 'Unpin session',
    icon: PinOff,
    group: 'act',
    when: ({ facts }) => isLive({ facts }) && facts.isPinned,
    run: ({ facts, env }) => env.getState().unpinSession(facts.sessionId),
  },
  {
    id: 'session.startAgent',
    label: 'Start agent',
    icon: CONCEPT_ICONS.agents,
    group: 'act',
    when: isLive,
    run: ({ facts, env }) => {
      openLens({ env, sessionId: facts.sessionId, lens: 'agents' });
      dispatchAfterNavigation({ name: createAgentEventName(facts.sessionId) });
    },
  },
  {
    id: 'session.linkIssue',
    label: 'Link work',
    icon: Link2,
    group: 'act',
    shortcut: 'session.linkWork',
    when: isLive,
    run: ({ facts, env }) => {
      openLens({ env, sessionId: facts.sessionId, lens: null });
      dispatchAfterNavigation({ name: linkIssueEventName({ sessionId: facts.sessionId }) });
    },
  },
  {
    id: 'session.copyTitle',
    label: 'Copy title',
    icon: Copy,
    group: 'copy',
    when: () => true,
    run: ({ facts, env }) => env.copyText({ text: facts.title }),
  },
  {
    id: 'session.copyWorktreePath',
    label: 'Copy worktree path',
    icon: CONCEPT_ICONS.worktree,
    group: 'copy',
    when: ({ facts }) => worktreesOf({ facts }).length > 0,
    choices: worktreeChoices,
    run: ({ facts, env, choice }) => {
      const text = worktreeTextFor({ facts, choice });
      if (text === null) {
        return;
      }
      return env.copyText({ text });
    },
  },
  {
    id: 'session.copyBranch',
    label: 'Copy branch name',
    icon: GitBranch,
    group: 'copy',
    when: ({ facts }) => facts.branch !== null,
    run: ({ facts, env }) => env.copyText({ text: facts.branch ?? '' }),
  },
  {
    id: 'session.copyPr',
    label: 'Copy PR link',
    icon: Link,
    group: 'copy',
    when: ({ facts }) => facts.prUrl !== null,
    run: ({ facts, env }) => env.copyText({ text: facts.prUrl ?? '' }),
  },
  {
    id: 'session.archive',
    label: 'Archive',
    icon: CONCEPT_ICONS.archive,
    group: 'danger',
    shortcut: 'session.archive',
    isUndoable: true,
    when: isLive,
    run: ({ facts, env }) => archive({ env, session: facts.session }),
  },
  {
    id: 'session.restore',
    label: 'Restore',
    icon: CONCEPT_ICONS.restore,
    group: 'act',
    shortcut: 'session.archive',
    when: ({ facts }) => facts.isArchived,
    run: ({ facts, env }) => restore({ env, session: facts.session }),
  },
  {
    id: 'session.delete',
    label: 'Delete',
    icon: CONCEPT_ICONS.delete,
    group: 'danger',
    shortcut: 'session.delete',
    when: () => true,
    confirm: deleteConfirm,
    run: ({ facts, env }) => env.getState().deleteTask(facts.sessionId),
  },
];

const findSession = ({
  sessions,
  archived,
  sessionId,
}: {
  readonly sessions: ReadonlyArray<Session>;
  readonly archived: ReadonlyArray<Session>;
  readonly sessionId: SessionId;
}): Session | null =>
  sessionById(sessions, sessionId) ??
  archived.find((candidate) => candidate.id === sessionId) ??
  null;

export const SESSION_KIND: ObjectKindDefinition<SessionActionTarget, SessionFacts> = {
  noun: 'session',
  facts: ({ state, target }) => {
    const session = findSession({
      sessions: state.sessions,
      archived: Object.values(state.archivedSessions).flat(),
      sessionId: target.sessionId,
    });
    if (session === null) {
      return null;
    }
    const rawBranch = state.sessionBranches[target.sessionId] ?? null;
    const branch = rawBranch === null || rawBranch.trim() === '' ? null : rawBranch;
    const mounts = state.sessionProjectMounts[target.sessionId] ?? [];
    const worktreePaths = state.sessionWorktrees[target.sessionId] ?? [];
    return {
      session,
      sessionId: target.sessionId,
      title: sessionTitle({ session }),
      isArchived: session.archivedAt != null,
      isPinned: (state.sessionPins[session.workspaceId as WorkspaceId] ?? []).some(
        (pin) => pin.id === target.sessionId,
      ),
      isBranchless: isBranchlessSession({ branch: rawBranch }),
      hasMount: mounts.length > 0 || branch !== null,
      branch: branch ?? mounts[0]?.branch ?? null,
      worktreePath: worktreePaths[0] ?? null,
      mounts,
      worktreePaths,
      prUrl: state.sessionGithub[target.sessionId]?.pr?.url ?? null,
    };
  },
  actions: SESSION_ACTIONS,
};
