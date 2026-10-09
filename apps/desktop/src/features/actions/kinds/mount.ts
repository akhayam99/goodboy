import {
  ArrowUpToLine,
  Copy,
  FolderOpen,
  GitBranch,
  GitPullRequestCreate,
  History,
  ListPlus,
  Play,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import type { RemoteHostKind } from '../../../shared/lib/remoteHost';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openInConfiguredEditor } from '../../../shared/lib/editorSettings';
import { NAMES } from '../../../shared/names';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { mountCleanupBlockers } from '../../../store/slices/mount-cleanup/cleanupPolicy';
import {
  mountRequestOf,
  sessionMountViews,
} from '../../../store/slices/project-mounts/mountRowModel';
import {
  selectActiveMountId,
  selectTurnMountCount,
} from '../../../store/slices/project-mounts/selectors';
import { isPrDraftAgentRunning } from '../../integrations/github/prDraftAgent';
import { mountReviewGithub } from '../../review/mountReviewGithub';
import { eligibleReviewThreadCount } from '../../suggestions/eligibleThreads';
import { BLOCKER_SENTENCE } from '../../session/components/SessionOverviewPane/ProjectMountRows/detachPlan';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import type {
  ActionConfirm,
  ActionDefinition,
  ObjectKindDefinition,
  MountActionTarget,
} from '../types';
import { abortRebase, plural, pushMount, rebaseMount, settleRequest } from './gitRuns';
import { mountFacts, type MountFacts } from './mountFacts';
import { selectProjectById } from '../../../store/slices/projects/selectProjectById';

type FactsOnly = { readonly facts: MountFacts };

export const MOUNT_SWITCH_BRANCH_EVENT = 'goodboy:mount-switch-branch';

export const MOUNT_PUT_TASK_EVENT = 'goodboy:mount-put-task';

export const mountEventName = ({
  name,
  mountId,
}: {
  readonly name: string;
  readonly mountId: MountId;
}): string => `${name}:${mountId}`;

const isOpen = ({ facts }: FactsOnly): boolean => !facts.isClosed && facts.worktreePath !== null;

const changes = ({ count }: { readonly count: number }): string =>
  plural({ count, one: 'uncommitted change', many: 'uncommitted changes' });

const statusParams = ({ facts }: FactsOnly) => ({
  worktreePath: facts.worktreePath ?? '',
  baseBranch: facts.mountBaseBranch,
});

const openLens = ({
  facts,
  env,
  lens,
}: FactsOnly & {
  readonly env: Parameters<ActionDefinition<MountFacts>['run']>[0]['env'];
  readonly lens: 'review' | 'scripts';
}): void => {
  const state = env.getState();
  state.navigate({ to: lensPlace({ state, sessionId: facts.sessionId, lens }) });
};

const closeConfirm = ({ facts }: FactsOnly): ActionConfirm => {
  if (facts.pr === 'merged') {
    return {
      title: `Remove the worktree for ${facts.label}?`,
      description:
        'Its folder is deleted. Removal stops on its own when the folder holds uncommitted or unpushed work.',
      confirmLabel: 'Remove worktree',
      role: 'danger',
    };
  }
  return {
    title: `Close the worktree for ${facts.label}?`,
    description:
      facts.dirty > 0
        ? `The branch and any pull request stay, and the ${changes({ count: facts.dirty })} stay on disk.`
        : 'Its folder is removed. The branch and any pull request stay.',
    confirmLabel: facts.dirty > 0 ? 'Close, keep changes' : 'Close worktree',
    role: 'alert',
  };
};

const REFERENCE_EDITORS = new Set(['code', 'cursor']);

const MOUNT_ACTIONS: ReadonlyArray<ActionDefinition<MountFacts>> = [
  {
    id: 'mount.openPullRequest',
    label: ({ facts }) => `Open ${facts.requestLabel ?? 'the pull request'}`,
    shortLabel: ({ facts }) => facts.requestLabel ?? 'Pull request',
    icon: CONCEPT_ICONS.pr,
    group: 'open',
    shortcut: 'lens.pr',
    when: ({ facts }) => facts.pr !== null && !facts.isClosed,
    slot: () => 'inline',
    run: async ({ facts, env }) => {
      if (facts.requestProvider === null) {
        return;
      }
      settleRequest({
        outcome: await env.getState().openMountRequest({
          sessionId: facts.sessionId,
          mountId: facts.mountId,
          provider: facts.requestProvider,
          ...(facts.requestNumber !== null && { requestNumber: facts.requestNumber }),
        }),
      });
    },
  },
  {
    id: 'mount.openDiff',
    label: `Open ${NAMES.files}`,
    icon: CONCEPT_ICONS.diff,
    group: 'open',
    shortcut: 'lens.files',
    when: ({ facts }) => isOpen({ facts }) && (facts.ahead > 0 || facts.dirty > 0),
    slot: () => 'inline',
    run: ({ facts, env }) => {
      if (facts.worktreePath !== null) {
        env.getState().openMountDiff(facts.sessionId, facts.worktreePath);
      }
    },
  },
  {
    id: 'mount.openReview',
    label: `Open ${NAMES.comments}`,
    shortLabel: ({ facts }) => `${facts.comments} to resolve`,
    icon: CONCEPT_ICONS.review,
    group: 'open',
    shortcut: 'lens.review',
    when: ({ facts }) => facts.comments > 0 && !facts.isClosed,
    slot: () => 'inline',
    run: async ({ facts, env }) => {
      settleRequest({
        outcome: await env.getState().openReviewTarget({
          sessionId: facts.sessionId,
          ...(facts.requestNumber !== null && {
            destination: {
              kind: 'comments',
              mountId: facts.mountId,
              prNumber: facts.requestNumber,
            },
          }),
        }),
      });
    },
  },
  {
    id: 'mount.openTerminal',
    label: 'Open terminal',
    icon: CONCEPT_ICONS.terminal,
    group: 'open',
    shortcut: 'lens.terminal',
    when: isOpen,
    slot: ({ facts }) => (facts.isRebasing ? 'notice' : 'menu'),
    run: ({ facts, env }) => {
      if (facts.worktreePath !== null) {
        env.getState().openMountTerminal(facts.sessionId, facts.worktreePath);
      }
    },
  },
  {
    id: 'mount.openInEditor',
    label: 'Open in editor',
    icon: CONCEPT_ICONS.editor,
    group: 'open',
    when: isOpen,
    choices: ({ facts }) =>
      facts.editors.map((editor) => ({ id: editor.binary, label: editor.label, isCurrent: false })),
    run: async ({ facts, env, choice }) => {
      if (facts.worktreePath === null) {
        return;
      }
      await openInConfiguredEditor({
        path: facts.worktreePath,
        state: env.getState(),
        ...(choice !== null && { editor: choice }),
      });
    },
  },
  {
    id: 'mount.scripts',
    label: 'Open scripts',
    icon: CONCEPT_ICONS.scripts,
    group: 'open',
    when: isOpen,
    run: ({ facts, env }) => {
      env.getState().setScriptsLensScope({ scope: { projectId: facts.projectId } });
      openLens({ facts, env, lens: 'scripts' });
    },
  },
  {
    id: 'mount.rebase',
    label: ({ facts }) => `Rebase on ${facts.baseBranch}`,
    icon: GitBranch,
    group: 'act',
    when: ({ facts }) => isOpen({ facts }) && facts.behind > 0 && !facts.isRebasing,
    blockedReason: ({ facts }) =>
      facts.dirty > 0 ? `Commit or discard the ${changes({ count: facts.dirty })} first.` : null,
    slot: ({ facts }) => (facts.pr === 'merged' ? 'menu' : 'inline'),
    pendingLabel: ({ facts }) => `Rebasing on ${facts.baseBranch}…`,
    run: ({ facts, env }) =>
      rebaseMount({
        env,
        sessionId: facts.sessionId,
        mountId: facts.mountId,
        ...statusParams({ facts }),
      }),
  },
  {
    id: 'mount.push',
    label: ({ facts }) =>
      `Push ${plural({ count: facts.unpushed, one: 'commit', many: 'commits' })}`,
    icon: ArrowUpToLine,
    group: 'act',
    when: ({ facts }) =>
      isOpen({ facts }) &&
      facts.unpushed > 0 &&
      !facts.isRebasing &&
      facts.pr !== null &&
      facts.pr !== 'merged',
    blockedReason: ({ facts }) =>
      facts.isDiverged
        ? 'Origin has a commit this branch lacks. Rebase on it first; Rewrite history owns force pushes.'
        : null,
    slot: ({ facts }) => (facts.behind === 0 && !facts.isDiverged ? 'inline' : 'menu'),
    pendingLabel: () => 'Pushing…',
    run: ({ facts, env }) =>
      pushMount({
        env,
        sessionId: facts.sessionId,
        mountId: facts.mountId,
        ...statusParams({ facts }),
      }),
  },
  {
    id: 'mount.createPullRequest',
    label: ({ facts }) => (facts.createProvider === 'gitlab' ? 'Create MR' : 'Create PR'),
    icon: GitPullRequestCreate,
    group: 'act',
    when: ({ facts }) =>
      isOpen({ facts }) &&
      facts.pr === null &&
      facts.ahead > 0 &&
      !facts.isRebasing &&
      facts.createProvider !== null,
    blockedReason: ({ facts }) =>
      facts.createProvider === 'github' && facts.isDraftAgentRunning
        ? 'An agent is already opening a pull request.'
        : null,
    slot: ({ facts }) => (facts.behind === 0 ? 'inline' : 'menu'),
    run: async ({ facts, env }) => {
      if (facts.createProvider === null) {
        return;
      }
      settleRequest({
        outcome: await env.getState().openMountRequest({
          sessionId: facts.sessionId,
          mountId: facts.mountId,
          provider: facts.createProvider,
        }),
      });
    },
  },
  {
    id: 'mount.abortRebase',
    label: 'Abort rebase',
    icon: Undo2,
    group: 'act',
    when: ({ facts }) => isOpen({ facts }) && facts.isRebasing,
    slot: () => 'notice',
    pendingLabel: () => 'Aborting…',
    confirm: () => ({
      title: 'Abort the rebase?',
      description:
        'The branch goes back to where it was before the rebase started. Conflict fixes made so far are lost.',
      confirmLabel: 'Abort rebase',
      role: 'danger',
    }),
    run: ({ facts }) => abortRebase(statusParams({ facts })),
  },
  {
    id: 'mount.rewriteHistory',
    label: 'Rewrite history',
    icon: History,
    group: 'act',
    when: ({ facts }) => isOpen({ facts }) && facts.ahead > 0 && facts.pr !== 'merged',
    blockedReason: ({ facts }) => {
      if (facts.isRebasing) {
        return 'Finish or abort the rebase first.';
      }
      return facts.dirty > 0
        ? `Commit or discard the ${changes({ count: facts.dirty })} first.`
        : null;
    },
    run: ({ facts, env }) => env.getState().openRewriteHistory(facts.sessionId, facts.worktreePath),
  },
  {
    id: 'mount.switchBranch',
    label: 'Switch branch…',
    icon: GitBranch,
    group: 'act',
    when: ({ facts }) => isOpen({ facts }) && facts.isRepo && !facts.isRebasing,
    blockedReason: ({ facts }) =>
      facts.dirty > 0
        ? `The ${changes({ count: facts.dirty })} would follow you. Commit or discard them first.`
        : null,
    slot: () => 'chip',
    run: ({ facts }) => {
      dispatchAfterNavigation({
        name: mountEventName({ name: MOUNT_SWITCH_BRANCH_EVENT, mountId: facts.mountId }),
      });
    },
  },
  {
    id: 'mount.putTaskOnBranch',
    slot: () => 'chip',
    label: 'Put on a branch',
    icon: ListPlus,
    group: 'act',
    when: ({ facts }) => facts.branch !== '' && !facts.isClosed,
    run: ({ facts }) => {
      dispatchAfterNavigation({
        name: mountEventName({ name: MOUNT_PUT_TASK_EVENT, mountId: facts.mountId }),
      });
    },
  },
  {
    id: 'mount.startTurnsHere',
    label: 'Start new turns here',
    icon: Play,
    group: 'act',
    when: ({ facts }) => isOpen({ facts }) && facts.canStartTurnsHere,
    run: ({ facts, env }) =>
      env.getState().setSessionActiveMount({ sessionId: facts.sessionId, mountId: facts.mountId }),
  },
  {
    id: 'mount.reopen',
    label: 'Reopen',
    icon: RotateCcw,
    group: 'act',
    when: ({ facts }) => facts.isClosed,
    slot: () => 'inline',
    pendingLabel: () => 'Reopening…',
    run: async ({ facts, env }) => {
      await env.getState().attachMount({ sessionId: facts.sessionId, mountId: facts.mountId });
    },
  },
  {
    id: 'mount.copyBranch',
    label: 'Copy branch name',
    icon: Copy,
    group: 'copy',
    when: ({ facts }) => facts.branch !== '',
    run: ({ facts, env }) => env.copyText({ text: facts.branch }),
  },
  {
    id: 'mount.copyPath',
    label: 'Copy path',
    icon: FolderOpen,
    group: 'copy',
    when: ({ facts }) => (facts.worktreePath ?? facts.keptPath) !== null,
    run: ({ facts, env }) => env.copyText({ text: facts.worktreePath ?? facts.keptPath ?? '' }),
  },
  {
    id: 'mount.close',
    label: ({ facts }) => (facts.pr === 'merged' ? 'Remove worktree' : 'Close worktree'),
    icon: CONCEPT_ICONS.worktree,
    group: 'danger',
    when: ({ facts }) => isOpen({ facts }) && !facts.isRebasing,
    slot: ({ facts }) => (facts.pr === 'merged' ? 'inline' : 'menu'),
    pendingLabel: ({ facts }) => (facts.pr === 'merged' ? 'Removing…' : 'Closing…'),
    confirm: closeConfirm,
    run: async ({ facts, env }) => {
      if (facts.pr === 'merged') {
        const result = await env.getState().removeMountWorktree({
          sessionId: facts.sessionId,
          mountId: facts.mountId,
          mode: 'safe',
        });
        if (result.kind === 'kept' || result.kind === 'failed') {
          throw new Error(result.reason ?? `The worktree for ${facts.label} stayed.`);
        }
        return;
      }
      const result = await env
        .getState()
        .unmountMount({ sessionId: facts.sessionId, mountId: facts.mountId });
      if (result.kept && facts.worktreePath !== null) {
        env.showToast({ kind: 'info', message: `Worktree kept at ${facts.worktreePath}` });
      }
    },
  },
  {
    id: 'mount.forget',
    label: NAMES.removeFromSession,
    icon: CONCEPT_ICONS.delete,
    group: 'danger',
    when: ({ facts }) => facts.isClosed,
    blockedReason: ({ facts }) => facts.blockers[0] ?? null,
    confirm: ({ facts }) => ({
      title: `Remove ${facts.label} from this session?`,
      description:
        facts.keptPath === null
          ? 'The branch and any pull request stay.'
          : `The branch and any pull request stay, and its files stay on disk at ${facts.keptPath}.`,
      confirmLabel: 'Remove',
      role: 'alert',
    }),
    run: async ({ facts, env }) => {
      await env.getState().forgetMount({ sessionId: facts.sessionId, mountId: facts.mountId });
    },
  },
];

export const mountFactsFor = ({
  state,
  sessionId,
  mountId,
  status,
  remoteKind,
}: {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly status: WorktreeStatus | null;
  readonly remoteKind: RemoteHostKind | null;
}): MountFacts | null => {
  const view =
    sessionMountViews({ state, sessionId }).find((candidate) => candidate.id === mountId) ?? null;
  if (view === null) {
    return null;
  }
  const project = selectProjectById(state, view.projectId);
  const request = mountRequestOf({ state, mountId });
  const github = mountReviewGithub({ state, sessionId, mountId });
  const isAttached = view.isAttached && view.worktreePath !== null;
  const path = view.worktreePath ?? view.lastWorktreePath ?? '';
  const agents = state.sessionPhaseRuns[sessionId] ?? null;
  const label = view.branch === '' ? (project?.name ?? view.mountName) : view.branch;
  return mountFacts({
    sessionId,
    mountId,
    projectId: view.projectId,
    label,
    branch: view.branch,
    baseBranch: view.baseBranch ?? project?.baseBranch ?? 'main',
    mountBaseBranch: view.baseBranch,
    worktreePath: view.worktreePath,
    keptPath:
      view.diskState === 'missing' || view.diskState === 'removed' ? null : view.lastWorktreePath,
    isRepo: (project?.kind ?? 'repo') === 'repo',
    isAttached,
    request,
    status,
    remoteKind,
    comments:
      request === null || request.provider !== 'github' || github?.pr?.number !== request.number
        ? 0
        : eligibleReviewThreadCount({
            github,
            rows: state.sessionResolveThreads[sessionId] ?? [],
          }),
    canStartTurnsHere:
      selectTurnMountCount({ state, sessionId }) > 1 &&
      selectActiveMountId({ state, sessionId }) !== mountId,
    isDraftAgentRunning: agents === null ? false : isPrDraftAgentRunning({ agents }),
    editors: state.detectedEditors.filter((editor) => REFERENCE_EDITORS.has(editor.binary)),
    blockers: mountCleanupBlockers({
      state,
      sessionId,
      mountId,
      worktreePath: path,
    }).map((blocker) => BLOCKER_SENTENCE[blocker]({ projectName: project?.name ?? label })),
  });
};

export const MOUNT_KIND: ObjectKindDefinition<MountActionTarget, MountFacts> = {
  noun: 'worktree',
  facts: ({ state, target }) =>
    mountFactsFor({
      state,
      sessionId: target.sessionId,
      mountId: target.mountId,
      status: target.status,
      remoteKind: target.remoteKind,
    }),
  actions: MOUNT_ACTIONS,
};
