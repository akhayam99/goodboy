// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';
import type { SessionSuggestion } from '../../types';

const { suggestionState } = vi.hoisted(() => ({
  suggestionState: {
    list: [] as ReadonlyArray<SessionSuggestion>,
    onAct: vi.fn(),
    onDismiss: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({ sessionPhaseRuns: {}, setActiveLens: vi.fn() }),
}));
vi.mock('../../useSessionSuggestions', () => ({
  useSessionSuggestions: () => suggestionState.list,
}));
vi.mock('../../useSuggestionActions', () => ({
  useSuggestionActions:
    () =>
    ({ suggestion }: { readonly suggestion: SessionSuggestion }) => ({
      primary: {
        label: `Act on ${suggestion.id}`,
        isDisabled: false,
        onAct: () => suggestionState.onAct(suggestion.id),
      },
      onDismiss:
        suggestion.kind === 'mount-project' ? () => suggestionState.onDismiss(suggestion.id) : null,
    }),
}));

import { NextStepSlot } from './index';

afterEach(() => {
  cleanup();
  suggestionState.list = [];
  suggestionState.onAct.mockReset();
  suggestionState.onDismiss.mockReset();
});

const SESSION = { id: 'session-1', workspaceId: 'ws-1' } as unknown as Session;

const suggestion = (overrides: Partial<SessionSuggestion> = {}): SessionSuggestion =>
  ({
    id: 'answer-questions:session-1',
    kind: 'answer-questions',
    priority: 0,
    band: 0,
    title: 'Answer open questions',
    detail: '2 questions blocking progress',
    sessionId: 'session-1',
    targetKey: null,
    fingerprint: 'answer-questions:session-1:2',
    payload: { count: 2 },
    ...overrides,
  }) as SessionSuggestion;

describe('NextStepSlot', () => {
  it('renders nothing when there is nothing to suggest', () => {
    const { container } = render(<NextStepSlot session={SESSION} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the top suggestion with its title and why', () => {
    suggestionState.list = [suggestion()];
    render(<NextStepSlot session={SESSION} />);
    expect(screen.getByText('Answer open questions')).toBeTruthy();
    expect(screen.getByText('2 questions blocking progress')).toBeTruthy();
  });

  it('fires the primary action from the shared resolver', () => {
    suggestionState.list = [suggestion()];
    render(<NextStepSlot session={SESSION} />);
    fireEvent.click(screen.getByRole('button', { name: 'Act on answer-questions:session-1' }));
    expect(suggestionState.onAct).toHaveBeenCalledWith('answer-questions:session-1');
  });

  it('collapses the rest behind "N more" until expanded', () => {
    suggestionState.list = [
      suggestion({ id: 'a' }),
      suggestion({ id: 'b', title: 'Rebase web' }),
      suggestion({ id: 'c', title: 'Fix review conversations' }),
    ];
    render(<NextStepSlot session={SESSION} />);
    expect(screen.queryByText('Rebase web')).toBeNull();
    fireEvent.click(screen.getByText('2 more'));
    expect(screen.getByText('Rebase web')).toBeTruthy();
    expect(screen.getByText('Fix review conversations')).toBeTruthy();
  });

  it('drops a suggestion locally once dismissed with Not now', () => {
    suggestionState.list = [
      suggestion({ id: 'mount-project:1', kind: 'mount-project', title: 'Add web' }),
    ];
    render(<NextStepSlot session={SESSION} />);
    fireEvent.click(screen.getByRole('button', { name: /More actions/ }));
    fireEvent.click(screen.getByText('Not now'));
    expect(suggestionState.onDismiss).toHaveBeenCalledWith('mount-project:1');
    expect(screen.queryByText('Add web')).toBeNull();
  });
});
