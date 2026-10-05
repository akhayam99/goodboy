import {
  ArrowUpToLine,
  ArchiveRestore,
  Copy,
  FileCode,
  GitBranch,
  GitCompare,
  GitPullRequestCreate,
  History,
  Undo2,
} from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openInConfiguredEditor } from '../../../shared/lib/editorSettings';
import { selectMountForPath } from '../../../store/slices/project-mounts/selectors';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import type { ActionDefinition, DiffActionTarget, ObjectKindDefinition } from '../types';
import { abortRebase, plural, pushMount, rebaseMount, settleRequest } from './gitRuns';
import { mountFactsFor } from './mount';
import type { MountFacts } from './mountFacts';

export type DiffFacts = MountFacts & {
  readonly patch: string;
  readonly rebaseConflicts: number;
};

type FactsOnly = { readonly facts: DiffFacts };

export const DIFF_CHANGE_BASE_EVENT = 'goodboy:diff-change-base';
export const HISTORY_SHOW_BACKUPS_EVENT = 'goodboy:history-show-backups';

export const diffEventName = ({
  name,
  sessionId,
}: {
  readonly name: string;
  readonly sessionId: SessionId;
}): string => `${name}:${sessionId}`;

const hasPr = ({ facts }: FactsOnly): boolean => facts.pr !== null;

const dirtyReason = ({ facts }: FactsOnly): string | null =>
  facts.dirty > 0
    ? `Commit or discard the ${plural({ count: facts.dirty, one: 'uncommitted change', many: 'uncommitted changes' })} first.`
    : null;

const statusParams = ({ facts }: FactsOnly) => ({
  worktreePath: facts.worktreePath ?? '',
  baseBranch: facts.mountBaseBranch,
});

const DIFF_ACTIONS: ReadonlyArray<ActionDefinition<DiffFacts>> = [
  {
    id: 'diff.continueRebase',
    label: 'Open terminal',
    icon: CONCEPT_ICONS.terminal,
    group: 'open',
    shortcut: 'lens.terminal',
    when: ({ facts }) => facts.isRebasing,
    slot: () => 'primary',
    run: ({ facts, env }) => {
      if (facts.worktreePath !== null) {
        env.getState().openMountTerminal(facts.sessionId, facts.worktreePath);
      }
    },
  },
  {
    id: 'diff.openTerminal',
    label: 'Open terminal',
    icon: CONCEPT_ICONS.terminal,
    group: 'open',
    shortcut: 'lens.terminal',
    when: ({ facts }) => !facts.isRebasing,
    run: ({ facts, env }) => {
      if (facts.worktreePath !== null) {
        env.getState().openMountTerminal(facts.sessionId, facts.worktreePath);
      }
    },
  },
  {
    id: 'diff.openInEditor',
    label: 'Open in editor',
    icon: FileCode,
    group: 'open',
    when: () => true,
    run: ({ facts, env }) => {
      if (facts.worktreePath !== null) {
        void openInConfiguredEditor({ path: facts.worktreePath, state: env.getState() });
      }
    },
  },
  {
    id: 'diff.rebase',
    label: ({ facts }) =>
      facts.rebaseConflicts > 0
        ? `Rebase on ${facts.baseBranch} · ${plural({ count: facts.rebaseConflicts, one: 'conflict', many: 'conflicts' })}`
        : `Rebase on ${facts.baseBranch}`,
    icon: GitBranch,
    group: 'act',
    when: ({ facts }) => facts.behind > 0 && !facts.isRebasing,
    blockedReason: dirtyReason,
    slot: () => 'primary',
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
    id: 'diff.push',
    label: ({ facts }) =>
      `Push ${plural({ count: facts.unpushed, one: 'commit', many: 'commits' })}`,
    icon: ArrowUpToLine,
    group: 'act',
    when: ({ facts }) =>
      facts.unpushed > 0 && hasPr({ facts }) && facts.pr !== 'merged' && !facts.isRebasing,
    blockedReason: ({ facts }) =>
      facts.isDiverged
        ? 'Origin has a commit this branch lacks. Rebase on it first; Rewrite history owns force pushes.'
        : null,
    slot: ({ facts }) => (facts.behind === 0 && !facts.isDiverged ? 'primary' : 'menu'),
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
    id: 'diff.createPullRequest',
    label: ({ facts }) => (facts.createProvider === 'gitlab' ? 'Create MR' : 'Create PR'),
    icon: GitPullRequestCreate,
    group: 'act',
    when: ({ facts }) =>
      !hasPr({ facts }) && facts.ahead > 0 && !facts.isRebasing && facts.createProvider !== null,
    blockedReason: ({ facts }) =>
      facts.createProvider === 'github' && facts.isDraftAgentRunning
        ? 'An agent is already opening a pull request.'
        : null,
    slot: ({ facts }) => (facts.behind === 0 ? 'primary' : 'menu'),
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
    id: 'diff.abortRebase',
    label: 'Abort rebase',
    icon: Undo2,
    group: 'act',
    when: ({ facts }) => facts.isRebasing,
    slot: () => 'secondary',
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
    id: 'diff.rewriteHistory',
    label: 'Rewrite history',
    icon: History,
    group: 'act',
    when: ({ facts }) => facts.ahead > 0 && facts.pr !== 'merged',
    blockedReason: ({ facts }) =>
      facts.isRebasing ? 'Finish or abort the rebase first.' : dirtyReason({ facts }),
    slot: () => 'secondary',
    run: ({ facts, env }) => env.getState().openRewriteHistory(facts.sessionId, facts.worktreePath),
  },
  {
    id: 'diff.changeBase',
    label: 'Change base branch…',
    icon: GitCompare,
    group: 'act',
    when: ({ facts }) => !facts.isRebasing && facts.isRepo,
    run: ({ facts }) => {
      dispatchAfterNavigation({
        name: diffEventName({ name: DIFF_CHANGE_BASE_EVENT, sessionId: facts.sessionId }),
      });
    },
  },
  {
    id: 'diff.restoreBackup',
    label: 'Restore a backup…',
    icon: ArchiveRestore,
    group: 'act',
    when: ({ facts }) => facts.ahead > 0,
    blockedReason: dirtyReason,
    run: ({ facts, env }) => {
      env.getState().openRewriteHistory(facts.sessionId, facts.worktreePath);
      dispatchAfterNavigation({
        name: diffEventName({ name: HISTORY_SHOW_BACKUPS_EVENT, sessionId: facts.sessionId }),
      });
    },
  },
  {
    id: 'diff.copyBranch',
    label: 'Copy branch name',
    icon: Copy,
    group: 'copy',
    when: ({ facts }) => facts.branch !== '',
    run: ({ facts, env }) => env.copyText({ text: facts.branch }),
  },
  {
    id: 'diff.copyPatch',
    label: 'Copy patch',
    icon: Copy,
    group: 'copy',
    when: ({ facts }) => facts.patch !== '' && (facts.ahead > 0 || facts.dirty > 0),
    run: ({ facts, env }) => env.copyText({ text: facts.patch }),
  },
];

export const DIFF_KIND: ObjectKindDefinition<DiffActionTarget, DiffFacts> = {
  noun: 'diff',
  facts: ({ state, target }) => {
    const mount = selectMountForPath({
      state,
      sessionId: target.sessionId,
      path: target.worktreePath,
    });
    if (mount === null || mount.mountId === undefined) {
      return null;
    }
    const facts = mountFactsFor({
      state,
      sessionId: target.sessionId,
      mountId: mount.mountId,
      status: target.status,
      remoteKind: target.remoteKind,
    });
    return facts === null
      ? null
      : { ...facts, patch: target.patch, rebaseConflicts: target.rebaseConflicts };
  },
  actions: DIFF_ACTIONS,
};
