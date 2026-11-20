import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/utils/names';
import { openFolderAction } from '../openFolderAction';
import { openInConfiguredTerminal } from '../../../shared/lib/terminalApp';
import type { ActionDefinition, ActionSubmenu } from '../types';
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

type TaggedParams = DefinitionsParams & {
  readonly ids: ReadonlyArray<string>;
  readonly submenu: ActionSubmenu;
};

const tagged = ({
  definitions,
  ids,
  submenu,
}: TaggedParams): ReadonlyArray<ActionDefinition<SessionFacts>> =>
  ids.flatMap((id) => {
    const definition = definitions.find((candidate) => candidate.id === id);
    return definition === undefined ? [] : [{ ...definition, submenu }];
  });

export const withSessionSubmenus = ({
  definitions,
}: DefinitionsParams): ReadonlyArray<ActionDefinition<SessionFacts>> => {
  const listed = new Set([...OPEN_IDS, ...COPY_IDS]);
  return [
    ...tagged({ definitions, ids: OPEN_IDS, submenu: 'open' }),
    ...definitions.filter((definition) => !listed.has(definition.id)),
    ...tagged({ definitions, ids: COPY_IDS, submenu: 'copy' }),
  ];
};

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
