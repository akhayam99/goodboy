import { NAMES } from '../../../shared/utils/names';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { openSessionTerminal } from '../../terminal/openSessionTerminal';
import { ALL_CHOICES_ID, type ActionChoice, type ActionDefinition } from '../types';
import type { SessionFacts } from './session';
import { VERBS } from '../../../shared/utils/verbs';

type SessionWorktree = {
  readonly id: string;
  readonly name: string;
  readonly branch: string | null;
  readonly path: string;
};

type FactsParams = {
  readonly facts: SessionFacts;
};

type WorktreeLabelParams = {
  readonly worktree: SessionWorktree;
};

type TextParams = FactsParams & {
  readonly choice: string | null;
};

const worktreesOf = ({ facts }: FactsParams): ReadonlyArray<SessionWorktree> => {
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

const worktreeChoices = ({ facts }: FactsParams): ReadonlyArray<ActionChoice> => {
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

const worktreeLabel = ({ worktree }: WorktreeLabelParams): string =>
  worktree.branch === null ? worktree.name : `${worktree.name} · ${worktree.branch}`;

const worktreeTerminalChoices = ({ facts }: FactsParams): ReadonlyArray<ActionChoice> => {
  const worktrees = worktreesOf({ facts });
  return worktrees.length < 2
    ? []
    : worktrees.map((worktree) => ({
        id: worktree.id,
        label: worktreeLabel({ worktree }),
        isCurrent: false,
        detail: worktree.path,
        keywords: [
          worktree.name,
          worktree.path,
          ...(worktree.branch === null ? [] : [worktree.branch]),
        ],
      }));
};

const worktreeTextFor = ({ facts, choice }: TextParams): string | null => {
  const worktrees = worktreesOf({ facts });
  if (choice === ALL_CHOICES_ID) {
    return worktrees.map((worktree) => worktree.path).join('\n');
  }
  if (choice === null) {
    return worktrees[0]?.path ?? null;
  }
  return worktrees.find((worktree) => worktree.id === choice)?.path ?? null;
};

export const SESSION_WORKTREE_ACTIONS: ReadonlyArray<ActionDefinition<SessionFacts>> = [
  {
    id: 'session.openWorktreeTerminal',
    ...VERBS.openInTerminal,
    menuLabel: NAMES.terminal,
    group: 'open',
    when: ({ facts }) => !facts.isArchived && worktreesOf({ facts }).length > 0,
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
    id: 'session.copyWorktreePath',
    ...VERBS.copyWorktreePath,
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
];
