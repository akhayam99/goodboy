// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionSuggestion } from '../../types';
import type { SuggestionActions } from '../../useSuggestionActions';
import type { AgentKindRouting } from '../../../session/agent-kind';
import { NextStepRow } from './NextStepRow';
import { useAppStore } from '../../../../store';
import { getCapabilities } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../providers/providers';

afterEach(() => {
  cleanup();
});

type ProviderParams = {
  readonly id: ProviderId;
};

const connectedProvider = ({ id }: ProviderParams): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: getCapabilities({ id }),
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const suggestion = (overrides: Partial<SessionSuggestion> = {}): SessionSuggestion =>
  ({
    id: 'merge-pr:mount-web',
    kind: 'merge-pr',
    priority: 44,
    band: 2,
    title: 'Merge #618',
    detail: 'Approved, checks passed',
    sessionId: 'session-1',
    targetKey: 'pr:mount-web',
    fingerprint: 'merge-pr:mount-web:618',
    payload: { mountId: 'mount-web', projectName: 'web', prNumber: 618, defaultMethod: 'squash' },
    ...overrides,
  }) as SessionSuggestion;

describe('NextStepRow', () => {
  it('acts right away when the action does not require a confirm', () => {
    const run = vi.fn(async () => undefined);
    const actions: SuggestionActions = {
      primary: { label: 'Answer', isDisabled: false, failureTitle: 'Failed', run },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'answer-questions' })}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('arms a confirm-requiring action instead of acting on the first click', () => {
    const run = vi.fn(async () => undefined);
    const actions: SuggestionActions = {
      primary: {
        label: 'Merge',
        isDisabled: false,
        requiresConfirm: true,
        failureTitle: 'Failed',
        run,
      },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion()}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('acts once the armed confirm is clicked again', () => {
    const run = vi.fn(async () => undefined);
    const actions: SuggestionActions = {
      primary: {
        label: 'Merge',
        isDisabled: false,
        requiresConfirm: true,
        failureTitle: 'Failed',
        run,
      },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion()}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('disarms on Cancel without acting', () => {
    const run = vi.fn(async () => undefined);
    const actions: SuggestionActions = {
      primary: {
        label: 'Merge',
        isDisabled: false,
        requiresConfirm: true,
        failureTitle: 'Failed',
        run,
      },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion()}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(run).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('shows the running action as busy and refuses a second click', () => {
    const run = vi.fn(async () => undefined);
    const actions: SuggestionActions = {
      primary: { label: 'Push', isDisabled: false, failureTitle: 'Failed', run },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'push-branch' })}
        actions={actions}
        compact={false}
        isPending
        onNotNow={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Push' });
    fireEvent.click(button);

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('disarms when the row switches to a different suggestion', () => {
    const run = vi.fn(async () => undefined);
    const actions: SuggestionActions = {
      primary: {
        label: 'Merge',
        isDisabled: false,
        requiresConfirm: true,
        failureTitle: 'Failed',
        run,
      },
      onDismiss: null,
    };
    const { rerender } = render(
      <NextStepRow
        suggestion={suggestion()}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    rerender(
      <NextStepRow
        suggestion={suggestion({ id: 'merge-pr:mount-other' })}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('renders each choice next to the primary action as a reachable button', () => {
    const first = vi.fn(async () => undefined);
    const second = vi.fn(async () => undefined);
    const actions: SuggestionActions = {
      primary: {
        label: 'Rebase',
        isDisabled: false,
        failureTitle: 'Failed',
        run: vi.fn(async () => undefined),
        choices: [
          {
            id: 'mount:ledger-core',
            label: 'ledger-core',
            description: 'feature/ledger-first',
            detail: '7 behind',
            run: first,
          },
          {
            id: 'mount:notify-relay',
            label: 'notify-relay',
            description: 'feature/relay',
            detail: '3 behind',
            run: second,
          },
        ],
      },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'rebase-project' })}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    const relay = screen.getByRole('button', { name: 'notify-relay' });
    expect(relay.getAttribute('title')).toBe('feature/relay, 3 behind');
    relay.focus();
    expect(document.activeElement).toBe(relay);
    fireEvent.click(relay);

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('shows the dirty line with Check again and Open terminal and no Rebase button', () => {
    const check = vi.fn(async () => undefined);
    const terminal = vi.fn(async () => undefined);
    const actions: SuggestionActions = {
      primary: null,
      onDismiss: null,
      extras: [
        {
          id: 'check-again',
          label: 'Check again',
          variant: 'secondary',
          failureTitle: 'Failed',
          run: check,
        },
        {
          id: 'open-terminal',
          label: 'Open terminal',
          variant: 'ghost',
          failureTitle: 'Failed',
          run: terminal,
        },
      ],
    };
    render(
      <NextStepRow
        suggestion={suggestion({
          kind: 'rebase-project',
          title: 'Rebase ledger-core on main',
          detail: '11 files not committed',
        })}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    screen.getByText('11 files not committed');
    expect(screen.queryByRole('button', { name: 'Rebase' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open terminal' }));

    expect(check).toHaveBeenCalledTimes(1);
    expect(terminal).toHaveBeenCalledTimes(1);
  });

  it('marks the extra action that is running as busy', () => {
    const actions: SuggestionActions = {
      primary: null,
      onDismiss: null,
      extras: [
        {
          id: 'check-again',
          label: 'Check again',
          variant: 'secondary',
          failureTitle: 'Failed',
          run: vi.fn(async () => undefined),
        },
      ],
    };
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'rebase-project' })}
        actions={actions}
        compact={false}
        isPending={false}
        pendingExtraIds={new Set(['check-again'])}
        onNotNow={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Check again' }).hasAttribute('disabled')).toBe(true);
  });

  it('names choices that share a label by their description', () => {
    const actions: SuggestionActions = {
      primary: {
        label: 'Rebase',
        isDisabled: false,
        failureTitle: 'Failed',
        run: vi.fn(async () => undefined),
        choices: [
          {
            id: 'a',
            label: 'ledger-core',
            description: 'feature/one',
            detail: '',
            run: vi.fn(async () => undefined),
          },
          {
            id: 'b',
            label: 'ledger-core',
            description: 'feature/two',
            detail: '',
            run: vi.fn(async () => undefined),
          },
        ],
      },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'rebase-project' })}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'feature/one' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'feature/two' })).toBeTruthy();
  });

  it('marks the running choice busy and holds the other controls', () => {
    const actions: SuggestionActions = {
      primary: {
        label: 'Start reviewer',
        isDisabled: false,
        failureTitle: 'Failed',
        run: vi.fn(async () => undefined),
        choices: [
          {
            id: 'start-tester',
            label: 'Start tester instead',
            description: '',
            detail: '',
            run: vi.fn(async () => undefined),
          },
        ],
      },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'check-changes' })}
        actions={actions}
        compact={false}
        isPending={false}
        pendingChoiceIds={new Set(['start-tester'])}
        onNotNow={vi.fn()}
      />,
    );

    const choice = screen.getByRole('button', { name: 'Start tester instead' });
    expect(choice.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('button', { name: 'Start reviewer' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('says where a one click reviewer runs and starts it on the model picked from Change', async () => {
    useAppStore.setState({
      providers: [connectedProvider({ id: 'anthropic' }), connectedProvider({ id: 'codex' })],
    });
    const run = vi.fn(async () => undefined);
    const runWith = vi.fn(async (_routing: AgentKindRouting) => undefined);
    const actions: SuggestionActions = {
      primary: {
        label: 'Start reviewer',
        isDisabled: false,
        failureTitle: 'Failed',
        run,
        runsOn: { kind: 'reviewer', runWith },
      },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'check-changes' })}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    expect(screen.getByTestId('runs-on').textContent).toContain('Runs on Sonnet 5.5 · High');

    fireEvent.click(screen.getByRole('button', { name: /Change/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Codex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start reviewer' }));

    expect(run).not.toHaveBeenCalled();
    expect(runWith).toHaveBeenCalledTimes(1);
    expect(runWith.mock.calls[0]?.[0]).toMatchObject({ provider: 'codex' });
  });

  it('runs the shown default when nothing was changed', () => {
    const run = vi.fn(async () => undefined);
    const runWith = vi.fn(async () => undefined);
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'check-changes' })}
        actions={{
          primary: {
            label: 'Start reviewer',
            isDisabled: false,
            failureTitle: 'Failed',
            run,
            runsOn: { kind: 'reviewer', runWith },
          },
          onDismiss: null,
        }}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start reviewer' }));

    expect(run).toHaveBeenCalledTimes(1);
    expect(runWith).not.toHaveBeenCalled();
  });
});
