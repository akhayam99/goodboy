import { Copy, GitBranch, Link } from 'lucide-react';
import type { Session, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { openInEditor } from '../../../shared/lib/editor';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { sessionTitle } from '../../session/sessionTitle';
import type {
  ActionConfirm,
  ActionDefinition,
  ActionEnv,
  FactsParams,
  ObjectKindDefinition,
  SessionActionTarget,
} from './types';

export type SessionFacts = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly title: string;
  readonly isArchived: boolean;
  readonly isBranchless: boolean;
  readonly hasMount: boolean;
  readonly branch: string | null;
  readonly worktreePath: string | null;
  readonly prUrl: string | null;
};

type OpenLensParams = {
  readonly env: ActionEnv;
  readonly sessionId: SessionId;
  readonly lens: 'review' | 'files' | 'terminal' | null;
};

type LifecycleParams = {
  readonly env: ActionEnv;
  readonly session: Session;
};

const NO_MOUNT_REASON = 'Add a project to this session first';

const NO_WORKTREE_REASON = 'This session has no worktree yet';

const openLens = ({ env, sessionId, lens }: OpenLensParams): void => {
  env.getState().navigate({ to: sessionPlace({ sessionId, lens }) });
};

const restore = async ({ env, session }: LifecycleParams): Promise<void> => {
  const { succeeded } = await env.getState().bulkUnarchiveTask([session.id as SessionId]);
  if (succeeded.length === 0) {
    return;
  }
  env.showToast({
    kind: 'success',
    title: 'Session restored',
    message: 'Back on the board, nothing was rebuilt.',
  });
};

const archive = async ({ env, session }: LifecycleParams): Promise<void> => {
  const { succeeded } = await env.getState().bulkArchiveTask([session.id as SessionId]);
  if (succeeded.length === 0) {
    return;
  }
  env.showToast({
    kind: 'info',
    title: 'Session archived',
    message: 'Branches, worktrees and history stay on disk.',
    action: { label: 'Undo', onClick: () => void restore({ env, session }) },
  });
};

const deleteConfirm = ({ facts }: FactsParams<SessionFacts>): ActionConfirm => ({
  title: 'Delete session?',
  description: facts.isBranchless
    ? 'Removes this session, its transcripts and every saved file version from this device. This cannot be undone.'
    : 'Removes this session and its transcripts from this device. The branch and its commits stay in the repository. This cannot be undone.',
  confirmLabel: 'Delete',
  role: 'danger',
  ...(!facts.isArchived && { altActionId: 'session.archive' }),
});

const isLive = ({ facts }: FactsParams<SessionFacts>): boolean => !facts.isArchived;

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
    run: ({ facts }) => {
      if (facts.worktreePath !== null) {
        void openInEditor({ path: facts.worktreePath });
      }
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

export const SESSION_KIND: ObjectKindDefinition<SessionActionTarget, SessionFacts> = {
  noun: 'session',
  facts: ({ state, target }) => {
    const session =
      state.sessions.find((candidate) => candidate.id === target.sessionId) ??
      Object.values(state.archivedSessions)
        .flat()
        .find((candidate) => candidate.id === target.sessionId) ??
      null;
    if (session === null) {
      return null;
    }
    const rawBranch = state.sessionBranches[target.sessionId] ?? null;
    const branch = rawBranch === null || rawBranch.trim() === '' ? null : rawBranch;
    const mounts = state.sessionProjectMounts[target.sessionId] ?? [];
    return {
      session,
      sessionId: target.sessionId,
      title: sessionTitle({ session }),
      isArchived: session.archivedAt != null,
      isBranchless: isBranchlessSession({ branch: rawBranch }),
      hasMount: mounts.length > 0 || branch !== null,
      branch: branch ?? mounts[0]?.branch ?? null,
      worktreePath: state.sessionWorktrees[target.sessionId]?.[0] ?? null,
      prUrl: state.sessionGithub[target.sessionId]?.pr?.url ?? null,
    };
  },
  actions: SESSION_ACTIONS,
};
