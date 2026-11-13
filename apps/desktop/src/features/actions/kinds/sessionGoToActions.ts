import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openFolderAction } from '../openFolderAction';
import { openInConfiguredTerminal } from '../../../shared/lib/terminalApp';
import type { ActionDefinition } from '../types';
import type { SessionFacts } from './session';

const NO_WORKTREE_REASON = 'This session has no worktree yet';

const GO_TO_IDS: ReadonlySet<string> = new Set([
  'session.open',
  'session.review',
  'session.diff',
  'session.changes',
  'session.editor',
  'session.terminalApp',
]);

type DefinitionsParams = {
  readonly definitions: ReadonlyArray<ActionDefinition<SessionFacts>>;
};

export const withGoToSubmenu = ({
  definitions,
}: DefinitionsParams): ReadonlyArray<ActionDefinition<SessionFacts>> =>
  definitions.map((definition) =>
    GO_TO_IDS.has(definition.id) ? { ...definition, submenu: 'goto' } : definition,
  );

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
    label: 'Open in terminal app',
    icon: CONCEPT_ICONS.terminal,
    group: 'open',
    when: ({ facts }) => !facts.isArchived,
    blockedReason: ({ facts }) => (facts.worktreePath === null ? NO_WORKTREE_REASON : null),
    run: ({ facts, env }) => {
      if (facts.worktreePath !== null) {
        void openInConfiguredTerminal({ path: facts.worktreePath, state: env.getState() });
      }
    },
  },
];
