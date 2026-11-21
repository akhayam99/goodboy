import { describe, expect, it } from 'vitest';
import type { ActionDefinition } from '../../features/actions/types';
import { VERBS } from '../../shared/utils/verbs';

type VerbKey = keyof typeof VERBS;

type AnyAction = ActionDefinition<never>;

const FAMILIES: Readonly<Record<VerbKey, ReadonlyArray<string>>> = {
  openInChanges: ['agent.changes', 'workflowRun.diff', 'mount.openDiff'],
  openInTerminal: [
    'mount.openTerminal',
    'diff.continueRebase',
    'diff.openTerminal',
    'script.openInTerminal',
    'session.openWorktreeTerminal',
  ],
  openInExternalTerminal: [
    'mount.openInTerminalApp',
    'session.terminalApp',
    'worktree.terminalApp',
    'exploreFile.openInTerminalApp',
  ],
  openTranscript: ['reviewComment.transcript'],
  copyPath: ['mount.copyPath', 'worktree.copyPath', 'diffFile.copyPath', 'exploreFile.copyPath'],
  copyWorktreePath: ['session.copyWorktreePath'],
  copyFolderPath: [],
  copyLink: [
    'checkRun.copyLink',
    'link.copy',
    'issueCandidate.copyLink',
    'record.copyLink',
    'reviewComment.copyLink',
    'pullRequest.copyLink',
    'session.copyPr',
  ],
  editDraft: ['reviewComment.edit'],
  markAsRead: ['session.markRead', 'notification.markRead'],
  markAsUnread: ['session.markUnread', 'notification.markUnread'],
  markAllAsRead: ['notifications.markAllRead'],
};

const DYNAMIC_LABEL: ReadonlySet<string> = new Set([
  'pullRequest.copyLink',
  'session.copyPr',
  'reviewComment.edit',
]);

const SHARED_ICON_ONLY: ReadonlySet<string> = new Set(['terminalTab.copyPath']);

const isAction = (value: unknown): value is AnyAction =>
  typeof value === 'object' && value !== null && 'id' in value && 'icon' in value;

const kindModules = import.meta.glob<Readonly<Record<string, unknown>>>(
  ['../../features/actions/kinds/*.ts', '!../../features/actions/kinds/*.test.ts'],
  { eager: true },
);

const ALL_ACTIONS: ReadonlyArray<AnyAction> = Object.values(kindModules).flatMap((module) =>
  Object.values(module).flatMap((exported) => {
    if (typeof exported !== 'object' || exported === null || !('actions' in exported)) {
      return [];
    }
    return Array.isArray(exported.actions) ? exported.actions.filter(isAction) : [];
  }),
);

const actionOf = (id: string): AnyAction | undefined =>
  ALL_ACTIONS.find((action) => action.id === id);

const isVerbKey = (key: string): key is VerbKey => key in VERBS;

const FAMILY_ENTRIES = Object.keys(FAMILIES)
  .filter(isVerbKey)
  .flatMap((key) => FAMILIES[key].map((id): [VerbKey, string] => [key, id]));

describe('one gesture, one label and one icon', () => {
  it('finds every action the families name', () => {
    expect(FAMILY_ENTRIES.filter(([, id]) => actionOf(id) === undefined)).toEqual([]);
  });

  it.each(FAMILY_ENTRIES.filter(([, id]) => !DYNAMIC_LABEL.has(id)))(
    '%s reads the same on %s',
    (key, id) => {
      const action = actionOf(id);

      expect(action?.label).toBe(VERBS[key].label);
      expect(action?.icon).toBe(VERBS[key].icon);
    },
  );

  it.each(FAMILY_ENTRIES.filter(([, id]) => DYNAMIC_LABEL.has(id)))(
    '%s draws its icon on %s',
    (key, id) => {
      const action = actionOf(id);

      expect(action?.iconOf ?? action?.icon).toBeDefined();
      expect(action?.icon).toBe(VERBS[key].icon);
    },
  );

  it('keeps the shared copy icon on the terminal tab path', () => {
    const action = actionOf([...SHARED_ICON_ONLY][0] ?? '');

    expect(action?.icon).toBe(VERBS.copyWorktreePath.icon);
  });

  it('gives every verb a label and an icon', () => {
    expect(
      Object.values(VERBS).filter((verb) => verb.label.length === 0 || verb.icon === undefined),
    ).toEqual([]);
  });
});

describe('the request noun comes from one place', () => {
  const sources = import.meta.glob<string>(
    ['../../features/actions/kinds/*.ts', '!../../features/actions/kinds/*.test.ts'],
    {
      eager: true,
      query: '?raw',
      import: 'default',
    },
  );
  const LITERAL_REQUEST = /\b(?:label|menuLabel|shortLabel|title)\b[^\n]*(?:pull request|\bPR\b)/i;
  const KNOWN_DEBT: Readonly<Record<string, number>> = {
    'mount.ts': 4,
    'diff.ts': 1,
    'pullRequest.ts': 1,
  };

  it('keeps a literal pull request out of an action label outside the known debt', () => {
    const grown = Object.entries(sources)
      .filter(([path]) => !path.endsWith('.test.ts'))
      .flatMap(([path, text]) => {
        const file = path.split('/').at(-1) ?? path;
        const count = text.split('\n').filter((line) => LITERAL_REQUEST.test(line)).length;
        return count > (KNOWN_DEBT[file] ?? 0) ? [`${file}: ${count}`] : [];
      });

    expect(grown).toEqual([]);
  });
});
