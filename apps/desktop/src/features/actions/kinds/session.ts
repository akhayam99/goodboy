import {
  DELETE_CANNOT_UNDO,
  DELETE_REMOVED_LINE,
  deleteKeptLine,
} from '../../session/deleteSessionCopy';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GitBranch,
  Link,
  Link2,
  ListChecks,
  Pencil,
  Pin,
  PinOff,
  Rocket,
} from 'lucide-react';
import type { MountId, Session, SessionId, SessionProjectMount, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { openInConfiguredEditor } from '../../../shared/lib/editorSettings';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { branchPlace } from '../../../store/slices/navigation/place';
import { openSessionTerminal } from '../../terminal/openSessionTerminal';
import { sessionTitle } from '../../session/sessionTitle';
import { archiveSessions, restoreSessions } from '../../session/sessionArchive';
import { archiveConfirmOf } from '../../session/archiveConfirmOf';
import { runningAgentCountOf } from '../../../store/slices/live-work/runningAgentCountOf';
import { openStartRun } from '../../session/startRun/openStartRun';
import { RUN_ROUTE_COPY } from '../../session/startRun/runRouteCopy';
import { refreshSession } from '../../session/refreshSession';
import { openSessionSpendLimitEdit } from '../../budget/openSessionSpendLimitEdit';
import { RENAME_REQUEST_EVENT, requestRename } from '../renameRequest';
import { requestSelect } from '../selectRequest';
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
import { linkedIssueSources } from '../../../store/slices/issue-briefs/linkedIssueSources';
import { writeGoalFromWorkEvent } from '../../../store/slices/issue-briefs/writeGoalFromWorkEvent';
import { NAMES } from '../../../shared/names';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import { SHORTCUTS } from '../../../shared/keyboard/registry';
import { behindBranchesOf } from '../../history/behindBranchesOf';
import { SESSION_REBASE_ACTIONS } from './sessionRebaseActions';

export type SessionFacts = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly title: string;
  readonly behindMountIds: ReadonlyArray<MountId>;
  readonly rebaseAllRunId: string | null;
  readonly isRebaseAllRunning: boolean;
  readonly isArchived: boolean;
  readonly isPinned: boolean;
  readonly isRefreshing: boolean;
  readonly canMovePinUp: boolean;
  readonly canMovePinDown: boolean;
  readonly isBranchless: boolean;
  readonly hasMount: boolean;
  readonly branch: string | null;
  readonly worktreePath: string | null;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly worktreePaths: ReadonlyArray<string>;
  readonly prUrl: string | null;
  readonly hasLinkedIssues: boolean;
  readonly runningAgentCount: number;
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

const NO_MOUNT_REASON = 'Add a folder to this session first';

const NO_WORKTREE_REASON = 'This session has no worktree yet';

const REFRESHING_REASON = 'Already refreshing';

const deleteDescription = ({ isBranchless }: { readonly isBranchless: boolean }): string =>
  `${DELETE_REMOVED_LINE} ${deleteKeptLine({ isBranchless })} ${DELETE_CANNOT_UNDO}`;

type OpenLensParams = {
  readonly env: ActionEnv;
  readonly sessionId: SessionId;
  readonly lens: 'review' | 'files' | 'agents' | null;
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

const archive = async ({ env, session }: LifecycleParams): Promise<void> => {
  await archiveSessions({ sessions: [session], ...lifecyclePorts({ env }) });
};

const restore = ({ env, session }: LifecycleParams): Promise<void> =>
  restoreSessions({ sessions: [session], ...lifecyclePorts({ env }) });

const deleteConfirm = ({ facts }: { readonly facts: SessionFacts }): ActionConfirm => ({
  title: 'Delete session?',
  description: deleteDescription({ isBranchless: facts.isBranchless }),
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

type WorktreeLabelParams = {
  readonly worktree: SessionWorktree;
};

type TerminalFactsParams = {
  readonly facts: SessionFacts;
};

const worktreeLabel = ({ worktree }: WorktreeLabelParams): string =>
  worktree.branch === null ? worktree.name : `${worktree.name} · ${worktree.branch}`;

const worktreeTerminalChoices = ({ facts }: TerminalFactsParams): ReadonlyArray<ActionChoice> => {
  const worktrees = worktreesOf({ facts });
  return worktrees.length < 2
    ? []
    : worktrees.map((worktree) => ({
        id: worktree.id,
        label: `Open ${worktreeLabel({ worktree })} in terminal`,
        isCurrent: false,
        detail: worktree.path,
        keywords: [
          worktree.name,
          worktree.path,
          ...(worktree.branch === null ? [] : [worktree.branch]),
        ],
      }));
};

const worktreeTerminalLabel = ({ facts }: TerminalFactsParams): string => {
  const [only] = worktreesOf({ facts });
  return worktreesOf({ facts }).length === 1 && only !== undefined
    ? `Open ${worktreeLabel({ worktree: only })} in terminal`
    : 'Open a worktree in terminal';
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
    label: NAMES.comments,
    icon: CONCEPT_ICONS.review,
    group: 'open',
    shortcut: 'lens.review',
    when: ({ facts }) => isLive({ facts }) && !facts.isBranchless,
    run: ({ facts, env }) =>
      env.getState().navigate({ to: branchPlace({ sessionId: facts.sessionId, tab: 'comments' }) }),
  },
  {
    id: 'session.diff',
    label: NAMES.files,
    icon: CONCEPT_ICONS.diff,
    group: 'open',
    shortcut: 'lens.files',
    when: ({ facts }) => isLive({ facts }) && !facts.isBranchless,
    blockedReason: ({ facts }) => (facts.hasMount ? null : NO_MOUNT_REASON),
    run: ({ facts, env }) => openLens({ env, sessionId: facts.sessionId, lens: 'files' }),
  },
  {
    id: 'session.changes',
    label: 'Changes',
    icon: CONCEPT_ICONS.diff,
    group: 'open',
    shortcut: 'lens.files',
    when: ({ facts }) => isLive({ facts }) && facts.isBranchless,
    run: ({ facts, env }) => openLens({ env, sessionId: facts.sessionId, lens: 'files' }),
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
    id: 'session.openLog',
    label: 'Open the full log',
    icon: CONCEPT_ICONS.timeline,
    group: 'open',
    when: () => true,
    run: ({ facts, env }) =>
      env.getState().openDrawer({
        kind: 'session-log',
        sessionId: facts.sessionId,
        payload: { focusEntryId: null },
      }),
  },
  {
    id: 'session.spend',
    label: 'Spend and limit',
    icon: CONCEPT_ICONS.budget,
    group: 'open',
    when: ({ facts }) => !facts.isArchived,
    run: ({ facts, env }) =>
      openSessionSpendLimitEdit({ state: env.getState(), sessionId: facts.sessionId }),
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
    id: 'session.select',
    label: 'Select',
    icon: ListChecks,
    group: 'act',
    when: ({ viewing }) => viewing?.kind === 'selection',
    run: ({ facts, env }) => {
      requestSelect({
        objectKey: sessionObjectKey({ sessionId: facts.sessionId }),
        anchorKey: env.anchorKey,
      });
    },
  },
  {
    id: 'session.pin',
    label: NAMES.pin,
    icon: Pin,
    group: 'act',
    when: ({ facts }) => isLive({ facts }) && !facts.isPinned,
    run: ({ facts, env }) => env.getState().pinSession(facts.sessionId),
  },
  {
    id: 'session.unpin',
    label: NAMES.unpin,
    icon: PinOff,
    group: 'act',
    when: ({ facts }) => isLive({ facts }) && facts.isPinned,
    run: ({ facts, env }) => env.getState().unpinSession(facts.sessionId),
  },
  {
    id: 'session.refresh',
    label: SHORTCUTS['session.refresh'].label,
    icon: CONCEPT_ICONS.refresh,
    group: 'act',
    shortcut: 'session.refresh',
    when: isLive,
    blockedReason: ({ facts }) => (facts.isRefreshing ? REFRESHING_REASON : null),
    run: ({ facts, env }) => {
      const state = env.getState();
      return refreshSession({
        sessionId: facts.sessionId,
        resyncSession: state.resyncSession,
        reportError: state.reportError,
      });
    },
  },
  {
    id: 'session.autopilotOn',
    label: `Turn on ${NAMES.autopilot}`,
    icon: Rocket,
    group: 'act',
    when: ({ facts }) => isLive({ facts }) && !facts.session.autoRun,
    run: ({ facts, env }) => env.getState().setSessionAutoRun(facts.sessionId, true),
  },
  {
    id: 'session.autopilotOff',
    label: `Turn off ${NAMES.autopilot}`,
    icon: Rocket,
    group: 'act',
    when: ({ facts }) => isLive({ facts }) && facts.session.autoRun,
    run: ({ facts, env }) => env.getState().setSessionAutoRun(facts.sessionId, false),
  },
  {
    id: 'session.pinnedUp',
    label: 'Move up',
    icon: ArrowUp,
    group: 'act',
    when: ({ facts }) => isLive({ facts }) && facts.isPinned && facts.canMovePinUp,
    run: ({ facts, env }) =>
      env.getState().moveSessionPin({ sessionId: facts.sessionId, direction: 'up' }),
  },
  {
    id: 'session.pinnedDown',
    label: 'Move down',
    icon: ArrowDown,
    group: 'act',
    when: ({ facts }) => isLive({ facts }) && facts.isPinned && facts.canMovePinDown,
    run: ({ facts, env }) =>
      env.getState().moveSessionPin({ sessionId: facts.sessionId, direction: 'down' }),
  },
  {
    id: 'session.startRun',
    label: RUN_ROUTE_COPY.label,
    icon: CONCEPT_ICONS.workflows,
    group: 'act',
    when: isLive,
    run: ({ facts }) => openStartRun({ sessionId: facts.sessionId }),
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
    id: 'session.openWorktreeTerminal',
    label: worktreeTerminalLabel,
    icon: CONCEPT_ICONS.terminal,
    group: 'open',
    when: ({ facts }) => isLive({ facts }) && worktreesOf({ facts }).length > 0,
    choices: worktreeTerminalChoices,
    run: ({ facts, env, choice }) => {
      const worktrees = worktreesOf({ facts });
      const picked = worktrees.find((worktree) => worktree.id === choice) ?? worktrees[0];
      if (picked === undefined) {
        return;
      }
      const state = env.getState();
      if (state.currentSessionId !== facts.sessionId) {
        state.navigate({ to: lensPlace({ state, sessionId: facts.sessionId, lens: null }) });
      }
      openSessionTerminal({ state, sessionId: facts.sessionId, cwd: picked.path });
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
    confirm: ({ facts }) =>
      archiveConfirmOf({ sessionCount: 1, runningAgentCount: facts.runningAgentCount }),
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
  {
    id: 'session.writeFromWork',
    label: 'Write title and goal from linked work',
    icon: Pencil,
    group: 'act',
    slot: () => 'menu',
    when: ({ facts }) => facts.hasLinkedIssues,
    run: ({ facts, env }) => {
      openLens({ env, sessionId: facts.sessionId, lens: null });
      dispatchAfterNavigation({ name: writeGoalFromWorkEvent({ sessionId: facts.sessionId }) });
    },
  },
  ...SESSION_REBASE_ACTIONS,
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
    const pins = state.sessionPins[session.workspaceId as WorkspaceId] ?? [];
    const pinIndex = pins.findIndex((pin) => pin.id === target.sessionId);
    const rawBranch = state.sessionBranches[target.sessionId] ?? null;
    const branch = rawBranch === null || rawBranch.trim() === '' ? null : rawBranch;
    const mounts = state.sessionProjectMounts[target.sessionId] ?? [];
    const worktreePaths = state.sessionWorktrees[target.sessionId] ?? [];
    return {
      session,
      hasLinkedIssues:
        linkedIssueSources({ tasks: state.sessionExternalTasks[target.sessionId] ?? [] }).length >
        0,
      sessionId: target.sessionId,
      title: sessionTitle({ session }),
      behindMountIds: behindBranchesOf({ state, sessionId: target.sessionId }).map(
        (branch) => branch.mountId,
      ),
      rebaseAllRunId: state.rebaseAllRuns[target.sessionId]?.id ?? null,
      isRebaseAllRunning: state.rebaseAllRuns[target.sessionId]?.phase === 'running',
      isArchived: session.archivedAt != null,
      isPinned: pinIndex !== -1,
      isRefreshing: state.sessionSyncing[target.sessionId] === true,
      canMovePinUp: pinIndex > 0,
      canMovePinDown: pinIndex !== -1 && pinIndex < pins.length - 1,
      isBranchless: isBranchlessSession({ branch: rawBranch }),
      hasMount: mounts.length > 0 || branch !== null,
      branch: branch ?? mounts[0]?.branch ?? null,
      worktreePath: worktreePaths[0] ?? null,
      mounts,
      worktreePaths,
      prUrl: state.sessionGithub[target.sessionId]?.pr?.url ?? null,
      runningAgentCount: runningAgentCountOf({ state, sessionId: target.sessionId }),
    };
  },
  actions: SESSION_ACTIONS,
};
