import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/utils/names';
import { openFolderAction } from '../openFolderAction';
import { openInConfiguredTerminal } from '../../../shared/lib/terminalApp';
import type { ActionDefinition } from '../types';
import { withSubmenus } from '../withSubmenus';
import type { SessionFacts } from './session';

const NO_WORKTREE_REASON = 'This session has no worktree yet';

const OPEN_IDS: ReadonlyArray<string> = [
  'session.open',
  'session.review',
  'session.diff',
  'session.changes',
  'session.openLog',
  'session.editor',
  'session.openWorktreeTerminal',
  'session.terminalApp',
];

const COPY_IDS: ReadonlyArray<string> = [
  'session.copyTitle',
  'session.copyBranch',
  'session.copyWorktreePath',
  'session.copyPr',
];

type DefinitionsParams = {
  readonly definitions: ReadonlyArray<ActionDefinition<SessionFacts>>;
};

export const withSessionSubmenus = ({
  definitions,
}: DefinitionsParams): ReadonlyArray<ActionDefinition<SessionFacts>> =>
  withSubmenus({ definitions, open: OPEN_IDS, copy: COPY_IDS });

export const SESSION_EXTERNAL_OPEN_ACTIONS: ReadonlyArray<ActionDefinition<SessionFacts>> = [
  {
    id: 'session.editor',
    label: 'Open in editor',
    icon: CONCEPT_ICONS.editor,
    group: 'open',
    when: ({ facts }) => !facts.isArchived,
    blockedReason: ({ facts }) => (facts.worktreePath === null ? NO_WORKTREE_REASON : null),
    run: ({ facts }) => openFolderAction({ path: facts.worktreePath, sessionId: facts.sessionId }),
  },
  {
    id: 'session.terminalApp',
    label: NAMES.openInExternalTerminal,
    icon: CONCEPT_ICONS.terminal,
    group: 'open',
    when: ({ facts }) => !facts.isArchived,
    blockedReason: ({ facts }) => (facts.worktreePath === null ? NO_WORKTREE_REASON : null),
    run: async ({ facts, env }) => {
      if (facts.worktreePath === null) {
        return;
      }
      await openInConfiguredTerminal({ path: facts.worktreePath, state: env.getState() });
    },
  },
];
