// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';
import type { SessionSuggestion } from '../../types';

const { suggestionState, transcriptState, recordNextStepOutcome, reportError } = vi.hoisted(() => ({
  transcriptState: { proposals: [] as ReadonlyArray<{ readonly projectId: string }> },
  suggestionState: {
    list: [] as ReadonlyArray<SessionSuggestion>,
    run: vi.fn(async (_id: string): Promise<void> => undefined),
    runChoice: vi.fn(async (_id: string): Promise<void> => undefined),
    onDismiss: vi.fn(async (_id: string): Promise<void> => undefined),
  },
  recordNextStepOutcome: vi.fn(async () => undefined),
  reportError: vi.fn(async (_params: unknown) => undefined),
}));

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: Object.freeze([]),
  sessionPlace: vi.fn(),
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({ sessionPhaseRuns: {}, reportError }),
}));
vi.mock('../../useSessionSuggestions', () => ({
  useSessionSuggestions: () => suggestionState.list,
}));
vi.mock('../../useTranscriptMountProposals', () => ({
  useTranscriptMountProposals: () => transcriptState.proposals,
}));
vi.mock('../../useSuggestionActions', () => ({
  useSuggestionActions:
    () =>
    ({ suggestion }: { readonly suggestion: SessionSuggestion }) => ({
      primary: {
        label: `Act on ${suggestion.id}`,
        isDisabled: false,
        failureTitle: `Couldn't act on ${suggestion.id}`,
        run: () => suggestionState.run(suggestion.id),
        ...(suggestion.kind === 'check-changes' && {
          choices: [
            {
              id: 'start-tester',
              label: 'Start tester instead',
              description: 'Writes tests for the changes',
              detail: '',
              run: () => suggestionState.runChoice('start-tester'),
            },
          ],
        }),
      },
      onDismiss:
        suggestion.kind === 'mount-project' ? () => suggestionState.onDismiss(suggestion.id) : null,
    }),
}));
vi.mock('../../useNextStepOutcomes', () => ({ recordNextStepOutcome }));

import { NextStepSlot } from './index';

afterEach(() => {
  cleanup();
  suggestionState.list = [];
  transcriptState.proposals = [];
  suggestionState.run.mockReset();
  suggestionState.run.mockResolvedValue(undefined);
  suggestionState.runChoice.mockReset();
  suggestionState.runChoice.mockResolvedValue(undefined);
  suggestionState.onDismiss.mockReset();
  suggestionState.onDismiss.mockResolvedValue(undefined);
  recordNextStepOutcome.mockReset();
  reportError.mockClear();
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
    const { container } = render(<NextStepSlot session={SESSION} onSelectLens={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the top suggestion with its title and why', () => {
    suggestionState.list = [suggestion()];
    render(<NextStepSlot session={SESSION} onSelectLens={vi.fn()} />);
    screen.getByText('Answer open questions');
    screen.getByText('2 questions blocking progress');
  });

  it('fires the primary action from the shared resolver', () => {
    suggestionState.list = [suggestion()];
    render(<NextStepSlot session={SESSION} onSelectLens={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Act on answer-questions:session-1' }));
    expect(suggestionState.run).toHaveBeenCalledWith('answer-questions:session-1');
    expect(recordNextStepOutcome).toHaveBeenCalledWith({
      sessionId: 'session-1',
      kind: 'answer-questions',
      outcome: 'accepted',
      fingerprint: 'answer-questions:session-1:2',
    });
  });

  it('leaves an approval to the needs-you callout that already shows that agent', () => {
    const approve = (agentId: string) =>
      suggestion({
        id: `approve-tool:${agentId}`,
        kind: 'approve-tool',
        title: `Approve for ${agentId}`,
        payload: { agentId, agentLabel: agentId, toolUseId: 't', toolName: 'Bash' },
      } as Partial<SessionSuggestion>);
    suggestionState.list = [approve('agent-shown'), approve('agent-other')];
    render(
      <NextStepSlot
        session={SESSION}
        onSelectLens={vi.fn()}
        shownAgentIds={new Set(['agent-shown'])}
      />,
    );

    expect(screen.queryByText('Approve for agent-shown')).toBeNull();
    screen.getByText('Approve for agent-other');
  });

  it('collapses the rest behind "N more" until expanded', () => {
    suggestionState.list = [
      suggestion({ id: 'a' }),
      suggestion({ id: 'b', title: 'Rebase web' }),
      suggestion({ id: 'c', title: 'Fix review conversations' }),
    ];
    render(<NextStepSlot session={SESSION} onSelectLens={vi.fn()} />);
    expect(screen.queryByText('Rebase web')).toBeNull();
    fireEvent.click(screen.getByText('2 more'));
    screen.getByText('Rebase web');
    screen.getByText('Fix review conversations');
  });

  it('drops a suggestion locally once dismissed with Not now', () => {
    suggestionState.list = [
      suggestion({ id: 'mount-project:1', kind: 'mount-project', title: 'Add web' }),
    ];
    render(<NextStepSlot session={SESSION} onSelectLens={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /More actions/ }));
    fireEvent.click(screen.getByText('Not now'));
    expect(suggestionState.onDismiss).toHaveBeenCalledWith('mount-project:1');
    expect(screen.queryByText('Add web')).toBeNull();
    expect(recordNextStepOutcome).toHaveBeenCalledWith({
      sessionId: 'session-1',
      kind: 'mount-project',
      outcome: 'dismissed',
      fingerprint: 'answer-questions:session-1:2',
    });
  });

  it('leaves a project proposal to the transcript that already shows it', () => {
    suggestionState.list = [
      suggestion({
        id: 'mount-project:project-web',
        kind: 'mount-project',
        title: 'Add web',
        payload: { projectId: 'project-web' },
      } as Partial<SessionSuggestion>),
      suggestion({ id: 'answer', title: 'Answer open questions' }),
    ];
    transcriptState.proposals = [{ projectId: 'project-web' }];
    render(<NextStepSlot session={SESSION} onSelectLens={vi.fn()} />);
    expect(screen.queryByText('Add web')).toBeNull();
    screen.getByText('Answer open questions');
  });

  it('keeps the clicked action busy until it settles, then clears it', async () => {
    let finish: () => void = () => undefined;
    suggestionState.run.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    suggestionState.list = [suggestion({ id: 'push-branch:mount-web', kind: 'push-branch' })];
    render(<NextStepSlot session={SESSION} onSelectLens={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Act on push-branch:mount-web' });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(suggestionState.run).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
    });
    expect(button.getAttribute('aria-busy')).toBeNull();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('logs a failed action once with its title and gives the button back', async () => {
    suggestionState.run.mockRejectedValueOnce(new Error('remote rejected the branch'));
    suggestionState.list = [suggestion({ id: 'push-branch:mount-web', kind: 'push-branch' })];
    render(<NextStepSlot session={SESSION} onSelectLens={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Act on push-branch:mount-web' });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith({
      title: "Couldn't act on push-branch:mount-web",
      error: new Error('remote rejected the branch'),
      sessionId: 'session-1',
    });
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('runs a choice through the same runner: busy, one run, one log on failure', async () => {
    let fail: (error: Error) => void = () => undefined;
    suggestionState.runChoice.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    );
    suggestionState.list = [
      suggestion({ id: 'check-changes:agent-1', kind: 'check-changes', band: 3 }),
    ];
    render(<NextStepSlot session={SESSION} onSelectLens={vi.fn()} />);
    const choice = screen.getByRole('button', { name: 'Start tester instead' });
    const primary = screen.getByRole('button', { name: 'Act on check-changes:agent-1' });

    fireEvent.click(choice);
    fireEvent.click(choice);

    expect(suggestionState.runChoice).toHaveBeenCalledTimes(1);
    expect(choice.getAttribute('aria-busy')).toBe('true');
    expect(primary.hasAttribute('disabled')).toBe(true);
    expect(recordNextStepOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'check-changes', outcome: 'accepted' }),
    );
    await act(async () => {
      fail(new Error('provider unavailable'));
    });
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith({
      title: "Couldn't act on check-changes:agent-1",
      error: new Error('provider unavailable'),
      sessionId: 'session-1',
    });
    expect(choice.hasAttribute('disabled')).toBe(false);
    expect(primary.hasAttribute('disabled')).toBe(false);
  });
});
