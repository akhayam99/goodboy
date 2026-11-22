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
  Link2,
  ListChecks,
  OctagonX,
  Pencil,
  Pin,
  PinOff,
  Rocket,
} from '@goodboy/ui/icons';
import type {
  MountId,
  PullRequestHost,
  Session,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { SESSION_OPEN_ACTIVITY } from './sessionActivity';
import { branchPlace } from '../../../store/slices/navigation/place';
import { sessionTitle } from '../../../shared/utils/sessionTitle';
import { archiveSessions, restoreSessions } from '../../session/sessionArchive';
import { archiveConfirmOf } from '../../session/archiveConfirmOf';
import { liveAgentsOf } from '../../../store/runtime/live-work/liveAgentsOf';
import { unreadTargetOf } from '../../../store/slices/agents/unreadTargetOf';
import { sessionHasUnread } from '../../../store/slices/session-view/sessionHasUnread';
import { openStartRun } from '../../session/startRun/openStartRun';
import { stopAllWithResume } from '../../session/stopAllWithResume';
import { refreshSession } from '../../session/refreshSession';
import { openSessionSpendLimitEdit } from '../../budget/openSessionSpendLimitEdit';
import { RENAME_REQUEST_EVENT, requestRename } from '../../../shared/utils/renameRequest';
import { requestSelect } from '../selectRequest';
import type {
  ActionConfirm,
  ActionDefinition,
  ActionEnv,
  ObjectKindDefinition,
  SessionActionTarget,
} from '../types';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { linkedIssueSources } from '../../../store/slices/issue-briefs/linkedIssueSources';
import { writeGoalFromWorkEvent } from '../../../store/slices/issue-briefs/writeGoalFromWorkEvent';
import { NAMES } from '../../../shared/utils/names';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import { behindBranchesOf } from '../../history/behindBranchesOf';
import { SESSION_EXTERNAL_OPEN_ACTIONS, withSessionSubmenus } from './sessionGoToActions';
import { copyRequestLinkLabelOf } from '../../branch/copyRequestLinkLabelOf';
import { VERBS } from '../../../shared/utils/verbs';
import { sessionPullRequestHostOf } from '../../../store/slices/review-source/sessionPullRequestOf';
import { lifecyclePortsOf } from './lifecyclePortsOf';
import { SESSION_BRANCH_ACTIONS } from './sessionBranchActions';
import { SESSION_ASK_ACTION } from './sessionAskAction';
import { SESSION_WORKTREE_ACTIONS } from './sessionWorktreeActions';
import { mergedFactsOf, type MergedFacts } from './mergedMountsOf';

export type SessionFacts = MergedFacts & {
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
  readonly requestHost: PullRequestHost;
  readonly hasLinkedIssues: boolean;
  readonly runningAgentCount: number;
  readonly hasUnread: boolean;
  readonly canMarkUnread: boolean;
};

const LINK_ISSUE_EVENT = 'goodboy:link-issue';

export const linkIssueEventName = ({ sessionId }: { readonly sessionId: SessionId }): string =>
  `${LINK_ISSUE_EVENT}:${sessionId}`;

export const sessionObjectKey = ({ sessionId }: { readonly sessionId: SessionId }): string =>
  `session:${sessionId}`;

export const SESSION_HEADER_ANCHOR = 'session-header';

const NO_MOUNT_REASON = 'Add a folder to this session first';

const REFRESHING_REASON = 'Already refreshing';

const deleteDescription = ({ isBranchless }: { readonly isBranchless: boolean }): string =>
  `${DELETE_REMOVED_LINE} ${deleteKeptLine({ isBranchless })} ${DELETE_CANNOT_UNDO}`;

type OpenLensParams = {
  readonly env: ActionEnv;
  readonly sessionId: SessionId;
  readonly lens: 'review' | 'files' | 'context' | null;
};

const openLens = ({ env, sessionId, lens }: OpenLensParams): void => {
  const state = env.getState();
  state.navigate({ to: lensPlace({ state, sessionId, lens }) });
};

type LifecycleParams = {
  readonly env: ActionEnv;
  readonly session: Session;
};

const archive = async ({ env, session }: LifecycleParams): Promise<void> => {
  await archiveSessions({ sessions: [session], ...lifecyclePortsOf({ env }) });
};

const restore = async ({ env, session }: LifecycleParams): Promise<void> => {
  await restoreSessions({ sessions: [session], ...lifecyclePortsOf({ env }) });
};

const deleteConfirm = ({ facts }: { readonly facts: SessionFacts }): ActionConfirm => ({
  title: 'Delete session?',
  description: deleteDescription({ isBranchless: facts.isBranchless }),
  confirmLabel: 'Delete',
  role: 'danger',
  ...(!facts.isArchived && { altActionId: 'session.archive' }),
});

const isUnarchived = ({ facts }: { readonly facts: SessionFacts }): boolean => !facts.isArchived;

const SESSION_ACTIONS: ReadonlyArray<ActionDefinition<SessionFacts>> = [
  {
    id: 'session.open',
    label: 'Open',
    menuLabel: NAMES.overview,
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
    when: ({ facts }) => isUnarchived({ facts }) && !facts.isBranchless,
    run: ({ facts, env }) =>
      env.getState().navigate({ to: branchPlace({ sessionId: facts.sessionId, tab: 'comments' }) }),
  },
  {
    id: 'session.diff',
    label: NAMES.changes,
    icon: CONCEPT_ICONS.diff,
    group: 'open',
    shortcut: 'lens.files',
    when: ({ facts }) => isUnarchived({ facts }) && !facts.isBranchless,
    blockedReason: ({ facts }) => (facts.hasMount ? null : NO_MOUNT_REASON),
    run: ({ facts, env }) => openLens({ env, sessionId: facts.sessionId, lens: 'files' }),
  },
  {
    id: 'session.changes',
    label: 'Changes',
    icon: CONCEPT_ICONS.diff,
    group: 'open',
    shortcut: 'lens.files',
    when: ({ facts }) => isUnarchived({ facts }) && facts.isBranchless,
    run: ({ facts, env }) => openLens({ env, sessionId: facts.sessionId, lens: 'files' }),
  },
  ...SESSION_EXTERNAL_OPEN_ACTIONS,
  SESSION_OPEN_ACTIVITY,
  {
    id: 'session.rename',
    label: 'Rename',
    icon: Pencil,
    group: 'act',
    when: isUnarchived,
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
    id: 'session.markUnread',
    ...VERBS.markAsUnread,
    group: 'act',
    when: ({ facts }) => isUnarchived({ facts }) && facts.canMarkUnread && !facts.hasUnread,
    run: ({ facts, env }) => env.getState().markSessionUnread({ sessionId: facts.sessionId }),
  },
  {
    id: 'session.markRead',
    ...VERBS.markAsRead,
    group: 'act',
    when: ({ facts }) => isUnarchived({ facts }) && facts.hasUnread,
    run: ({ facts, env }) => env.getState().markAllAgentsSeen(facts.sessionId),
  },
  {
    id: 'session.select',
    label: 'Select',
    icon: ListChecks,
    group: 'act',
    placement: 'palette',
    when: ({ viewing }) => viewing?.kind === 'selection',
    run: ({ facts, env }) => {
      requestSelect({
        objectKey: sessionObjectKey({ sessionId: facts.sessionId }),
        anchorKey: env.anchorKey,
      });
    },
  },
  SESSION_ASK_ACTION,
  {
    id: 'session.pin',
    label: NAMES.pin,
    icon: Pin,
    group: 'act',
    when: ({ facts }) => isUnarchived({ facts }) && !facts.isPinned,
    run: ({ facts, env }) => env.getState().pinSession(facts.sessionId),
  },
  {
    id: 'session.unpin',
    label: NAMES.unpin,
    icon: PinOff,
    group: 'act',
    when: ({ facts }) => isUnarchived({ facts }) && facts.isPinned,
    run: ({ facts, env }) => env.getState().unpinSession(facts.sessionId),
  },
  {
    id: 'session.refresh',
    label: 'Refresh session',
    icon: CONCEPT_ICONS.refresh,
    group: 'act',
    placement: 'palette',
    shortcut: 'view.reload',
    when: isUnarchived,
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
    id: 'session.asksNever',
    label: NAMES.startStepsWithoutAsking,
    icon: Rocket,
    group: 'act',
    placement: 'palette',
    when: ({ facts }) => isUnarchived({ facts }) && !facts.session.autoRun,
    run: ({ facts, env }) => env.getState().setSessionAutoRun(facts.sessionId, true),
  },
  {
    id: 'session.asksEveryStep',
    label: NAMES.askBeforeEachStep,
    icon: Rocket,
    group: 'act',
    placement: 'palette',
    when: ({ facts }) => isUnarchived({ facts }) && facts.session.autoRun,
    run: ({ facts, env }) => env.getState().setSessionAutoRun(facts.sessionId, false),
  },
  {
    id: 'session.pinnedUp',
    label: 'Move up',
    icon: ArrowUp,
    group: 'act',
    placement: 'palette',
    when: ({ facts }) => isUnarchived({ facts }) && facts.isPinned && facts.canMovePinUp,
    run: ({ facts, env }) =>
      env.getState().moveSessionPin({ sessionId: facts.sessionId, direction: 'up' }),
  },
  {
    id: 'session.pinnedDown',
    label: 'Move down',
    icon: ArrowDown,
    group: 'act',
    placement: 'palette',
    when: ({ facts }) => isUnarchived({ facts }) && facts.isPinned && facts.canMovePinDown,
    run: ({ facts, env }) =>
      env.getState().moveSessionPin({ sessionId: facts.sessionId, direction: 'down' }),
  },
  {
    id: 'session.startRun',
    label: NAMES.startARun,
    icon: CONCEPT_ICONS.workflows,
    group: 'act',
    when: isUnarchived,
    run: ({ facts }) => openStartRun({ sessionId: facts.sessionId }),
  },
  {
    id: 'session.linkIssue',
    label: 'Link work',
    icon: Link2,
    group: 'act',
    shortcut: 'session.linkWork',
    when: isUnarchived,
    run: ({ facts, env }) => {
      openLens({ env, sessionId: facts.sessionId, lens: 'context' });
      dispatchAfterNavigation({ name: linkIssueEventName({ sessionId: facts.sessionId }) });
    },
  },
  {
    id: 'session.spend',
    label: `${NAMES.setLimit}…`,
    icon: CONCEPT_ICONS.budget,
    group: 'act',
    when: ({ facts }) => !facts.isArchived,
    run: ({ facts, env }) =>
      openSessionSpendLimitEdit({ state: env.getState(), sessionId: facts.sessionId }),
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
    label: ({ facts }) => copyRequestLinkLabelOf({ host: facts.requestHost }),
    icon: VERBS.copyLink.icon,
    group: 'copy',
    when: ({ facts }) => facts.prUrl !== null,
    run: ({ facts, env }) => env.copyText({ text: facts.prUrl ?? '' }),
  },
  {
    id: 'session.stopAll',
    label: ({ facts }) => `${NAMES.stopRunning} (${facts.runningAgentCount})`,
    icon: OctagonX,
    group: 'danger',
    when: ({ facts }) => isUnarchived({ facts }) && facts.runningAgentCount > 0,
    isUndoable: true,
    run: ({ facts, env }) =>
      stopAllWithResume({
        getState: env.getState,
        sessionId: facts.sessionId,
        showToast: env.showToast,
      }),
  },
  {
    id: 'session.archive',
    label: 'Archive',
    icon: CONCEPT_ICONS.archive,
    group: 'danger',
    shortcut: 'session.archive',
    isUndoable: true,
    when: isUnarchived,
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
    placement: 'palette',
    slot: () => 'menu',
    when: ({ facts }) => facts.hasLinkedIssues,
    run: ({ facts, env }) => {
      openLens({ env, sessionId: facts.sessionId, lens: null });
      dispatchAfterNavigation({ name: writeGoalFromWorkEvent({ sessionId: facts.sessionId }) });
    },
  },
  ...SESSION_WORKTREE_ACTIONS,
  ...SESSION_BRANCH_ACTIONS,
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
      ...mergedFactsOf({ state, sessionId: target.sessionId }),
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
      requestHost: sessionPullRequestHostOf({ state, sessionId: target.sessionId }),
      runningAgentCount: liveAgentsOf({ state, sessionId: target.sessionId }).length,
      hasUnread: sessionHasUnread({ state, sessionId: target.sessionId }),
      canMarkUnread: unreadTargetOf({ state, sessionId: target.sessionId }) !== null,
    };
  },
  actions: withSessionSubmenus({ definitions: SESSION_ACTIONS }),
};
