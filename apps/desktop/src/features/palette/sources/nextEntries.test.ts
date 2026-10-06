// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { SuggestionActions } from '../../suggestions/useSuggestionActions';
import type { SessionSuggestion } from '../../suggestions/types';
import { nextEntries, type NextItem } from './nextEntries';

const SESSION = 'session-payout' as SessionId;

const suggestion = (overrides: Partial<SessionSuggestion> & { readonly id: string }) =>
  ({
    kind: 'push-branch',
    priority: 10,
    title: 'Push 2 commits',
    sessionId: SESSION,
    band: 2,
    fingerprint: 'fp',
    targetKey: null,
    payload: {},
    ...overrides,
  }) as SessionSuggestion;

const actions = (overrides: Partial<NonNullable<SuggestionActions['primary']>> = {}) =>
  ({
    primary: {
      label: 'Push',
      isDisabled: false,
      failureTitle: "Couldn't push the branch",
      run: async () => undefined,
      ...overrides,
    },
    onDismiss: null,
  }) satisfies SuggestionActions;

const item = (id: string, title: string, extra: Partial<SessionSuggestion> = {}): NextItem => ({
  suggestion: suggestion({ id, title, ...extra }),
  actions: actions(),
});

describe('nextEntries', () => {
  it('turns the top suggestions into rows with the suggestion titles', () => {
    const entries = nextEntries({
      items: [
        item('a', 'Answer 1 question from Planner', { band: 0, kind: 'answer-questions' }),
        item('b', 'Push 2 commits'),
      ],
      execute: vi.fn(),
    });

    expect(entries.map((entry) => [entry.key, entry.label, entry.tag])).toEqual([
      ['next:a', 'Answer 1 question from Planner', 'Needs you'],
      ['next:b', 'Push 2 commits', undefined],
    ]);
    expect(entries.every((entry) => entry.kind === 'next')).toBe(true);
  });

  it('keeps at most three rows', () => {
    const entries = nextEntries({
      items: ['a', 'b', 'c', 'd', 'e'].map((id) => item(id, `Step ${id}`)),
      execute: vi.fn(),
    });

    expect(entries.map((entry) => entry.label)).toEqual(['Step a', 'Step b', 'Step c']);
  });

  it('skips a suggestion with no action and the mount proposals', () => {
    const entries = nextEntries({
      items: [
        {
          suggestion: suggestion({ id: 'none', title: 'No handler' }),
          actions: { primary: null, onDismiss: null },
        },
        item('mount', 'Add payments-api', { kind: 'mount-project' }),
        item('keep', 'Push 2 commits'),
      ],
      execute: vi.fn(),
    });

    expect(entries.map((entry) => entry.key)).toEqual(['next:keep']);
  });

  it('runs the same handler as the slot when the row runs', () => {
    const execute = vi.fn();
    const first = item('a', 'Push 2 commits');
    const [entry] = nextEntries({ items: [first], execute });

    entry?.run();

    expect(execute).toHaveBeenCalledWith(first);
  });

  it('blocks a row whose action is disabled', () => {
    const [entry] = nextEntries({
      items: [
        {
          suggestion: suggestion({ id: 'a', title: 'Rebase on main' }),
          actions: actions({ isDisabled: true }),
        },
      ],
      execute: vi.fn(),
    });

    expect(entry?.isBlocked).toBe(true);
  });

  it('asks before an action that the slot confirms', () => {
    const [entry] = nextEntries({
      items: [
        {
          suggestion: suggestion({ id: 'a', title: 'Merge #318', detail: 'Squash into main' }),
          actions: actions({ label: 'Merge', requiresConfirm: true }),
        },
      ],
      execute: vi.fn(),
    });

    expect(entry?.confirm).toEqual({
      title: 'Merge #318',
      description: 'Squash into main',
      confirmLabel: 'Merge',
      role: 'alert',
    });
  });
});
