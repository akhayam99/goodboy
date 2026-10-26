import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openInConfiguredEditor } from '../../../shared/lib/editorSettings';
import { openInConfiguredTerminal } from '../../../shared/lib/terminalApp';
import type { ActionDefinition } from '../types';
import type { SessionFacts } from './session';

const NO_WORKTREE_REASON = 'This session has no worktree yet';

export const SESSION_EXTERNAL_OPEN_ACTIONS: ReadonlyArray<ActionDefinition<SessionFacts>> = [
  {
    id: 'session.editor',
    label: 'Open in editor',
    icon: CONCEPT_ICONS.editor,
    group: 'open',
    when: ({ facts }) => !facts.isArchived,
    blockedReason: ({ facts }) => (facts.worktreePath === null ? NO_WORKTREE_REASON : null),
    run: ({ facts, env }) => {
      if (facts.worktreePath !== null) {
        void openInConfiguredEditor({ path: facts.worktreePath, state: env.getState() });
      }
    },
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
