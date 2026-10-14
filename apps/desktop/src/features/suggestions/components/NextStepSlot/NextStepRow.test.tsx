// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

  it('asks in a popover instead of acting on the first click', () => {
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
    expect(screen.getByRole('dialog', { name: 'Merge?' })).toBeTruthy();
  });

  it('acts once the popover confirm is clicked', () => {
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
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Merge?' })).getByRole('button', { name: 'Merge' }),
    );

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
    expect(screen.queryByRole('dialog')).toBeNull();
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

  it('keeps the alternatives out of the row and opens them from the more menu', () => {
    const first = vi.fn(async () => undefined);
    const second = vi.fn(async () => undefined);
    const actions: SuggestionActions = {
      primary: {
        label: 'Open rebase',
        shortLabel: 'Rebase',
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

    expect(screen.queryByRole('button', { name: 'notify-relay' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More options for Merge #618' }));
    const relay = screen.getByRole('menuitem', { name: /notify-relay/ });
    expect(relay.textContent).toContain('feature/relay, 3 behind');
    fireEvent.click(relay);

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('leaves the more cell empty when there is nothing to put in the menu', () => {
    const actions: SuggestionActions = {
      primary: { label: 'Push', isDisabled: false, failureTitle: 'Failed', run: vi.fn() },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'push-branch' })}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /More options/ })).toBeNull();
    expect(
      screen.getByTestId('next-step-merge-pr:mount-web').querySelector('[data-column="menu"]'),
    ).not.toBeNull();
  });

  it('names a shared-label choice by its description', () => {
    const actions: SuggestionActions = {
      primary: {
        label: 'Open rebase',
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

    fireEvent.click(screen.getByRole('button', { name: /More options/ }));

    expect(screen.getByRole('menuitem', { name: /feature\/one/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /feature\/two/ })).toBeTruthy();
  });

  it('holds the primary and the more menu while a choice runs', () => {
    const actions: SuggestionActions = {
      primary: {
        label: 'Start reviewer',
        shortLabel: 'Start',
        agentKind: 'reviewer',
        isDisabled: false,
        failureTitle: 'Failed',
        run: vi.fn(async () => undefined),
        choices: [
          {
            id: 'start-tester',
            label: 'Start tester instead',
            description: '',
            detail: '',
            agentKind: 'tester',
            run: vi.fn(async () => undefined),
          },
          {
            id: 'start-implementer',
            label: 'Start implementer instead',
            description: '',
            detail: '',
            agentKind: 'implementer',
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

    expect(screen.getByRole('button', { name: 'Start reviewer' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(
      screen.getByRole('button', { name: /More options/, hidden: true }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('shows the role tile of the agent the primary starts, in the role color', () => {
    const actions: SuggestionActions = {
      primary: {
        label: 'Analyze',
        agentKind: 'debugger',
        isDisabled: false,
        failureTitle: 'Failed',
        run: vi.fn(async () => undefined),
      },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'fix-checks' })}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    const tile = screen
      .getByTestId('next-step-merge-pr:mount-web')
      .querySelector('[data-column="tile"]');
    expect(tile?.getAttribute('data-agent-kind')).toBe('debugger');
    const tileClasses = (tile?.className ?? '').split(' ');
    expect(tileClasses).toContain('text-agent-debugger');
    expect(tileClasses).toContain('bg-current/12');
  });

  it('keeps the suggestion icon in the same disc, tinted by the card tone, when no agent starts', () => {
    const actions: SuggestionActions = {
      primary: { label: 'Push', isDisabled: false, failureTitle: 'Failed', run: vi.fn() },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'push-branch' })}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    const tile = screen
      .getByTestId('next-step-merge-pr:mount-web')
      .querySelector('[data-column="tile"]');
    expect(tile?.getAttribute('data-agent-kind')).toBeNull();
    const tileClasses = (tile?.className ?? '').split(' ');
    expect(tileClasses).toContain('rounded-full');
    expect(tileClasses).toContain('bg-current/12');
  });

  it('puts an icon on every primary button, the role icon or the suggestion icon', () => {
    const withRole: SuggestionActions = {
      primary: {
        label: 'Analyze',
        agentKind: 'debugger',
        isDisabled: false,
        failureTitle: 'Failed',
        run: vi.fn(async () => undefined),
      },
      onDismiss: null,
    };
    const withoutRole: SuggestionActions = {
      primary: { label: 'Push', isDisabled: false, failureTitle: 'Failed', run: vi.fn() },
      onDismiss: null,
    };
    const view = render(
      <NextStepRow
        suggestion={suggestion({ kind: 'fix-checks' })}
        actions={withRole}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Analyze' }).querySelector('svg')).not.toBeNull();

    view.rerender(
      <NextStepRow
        suggestion={suggestion({ kind: 'push-branch' })}
        actions={withoutRole}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Push' }).querySelector('svg')).not.toBeNull();
  });

  it('previews the role of an alternative on the tile while it is hovered or focused', () => {
    const actions: SuggestionActions = {
      primary: {
        label: 'Start reviewer',
        shortLabel: 'Start',
        agentKind: 'reviewer',
        isDisabled: false,
        failureTitle: 'Failed',
        run: vi.fn(async () => undefined),
        choices: [
          {
            id: 'start-tester',
            label: 'Start tester instead',
            description: '',
            detail: '',
            agentKind: 'tester',
            run: vi.fn(async () => undefined),
          },
          {
            id: 'start-implementer',
            label: 'Start implementer instead',
            description: '',
            detail: '',
            agentKind: 'implementer',
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
        onNotNow={vi.fn()}
      />,
    );
    const tileKind = () =>
      screen
        .getByTestId('next-step-merge-pr:mount-web')
        .querySelector('[data-column="tile"]')
        ?.getAttribute('data-agent-kind');
    expect(tileKind()).toBe('reviewer');

    fireEvent.click(screen.getByRole('button', { name: /More options/ }));
    const tester = screen.getByRole('menuitem', { name: /Start tester instead/ });
    fireEvent.mouseEnter(tester);
    expect(tileKind()).toBe('tester');
    fireEvent.mouseLeave(tester);
    expect(tileKind()).toBe('reviewer');

    const implementer = screen.getByRole('menuitem', { name: /Start implementer instead/ });
    fireEvent.focus(implementer);
    expect(tileKind()).toBe('implementer');
  });

  it('fills no primary and gives every row the same columns', () => {
    const actions: SuggestionActions = {
      primary: {
        label: 'Start reviewer',
        shortLabel: 'Start',
        agentKind: 'reviewer',
        isDisabled: false,
        failureTitle: 'Failed',
        run: vi.fn(async () => undefined),
      },
      onDismiss: null,
    };
    const other: SuggestionActions = {
      primary: { label: 'Push', isDisabled: false, failureTitle: 'Failed', run: vi.fn() },
      onDismiss: null,
    };
    render(
      <>
        <NextStepRow
          suggestion={suggestion({ id: 'check-changes:a', kind: 'check-changes' })}
          actions={actions}
          compact={false}
          isPending={false}
          onNotNow={vi.fn()}
        />
        <NextStepRow
          suggestion={suggestion({ id: 'push-branch:b', kind: 'push-branch' })}
          actions={other}
          compact
          isPending={false}
          onNotNow={vi.fn()}
        />
      </>,
    );

    const lead = screen.getByRole('button', { name: 'Start reviewer' });
    const second = screen.getByRole('button', { name: 'Push' });
    expect(lead.getAttribute('data-variant')).toBe('secondary');
    expect(second.getAttribute('data-variant')).toBe('secondary');
    expect(lead.textContent).toBe('Start');

    const rows = [
      screen.getByTestId('next-step-check-changes:a'),
      screen.getByTestId('next-step-push-branch:b'),
    ];
    const gridClasses = rows.map((row) =>
      row.className.split(' ').filter((name) => name.startsWith('grid')),
    );
    expect(gridClasses[0]).toEqual(gridClasses[1]);
    for (const column of ['text', 'primary', 'not-now', 'menu']) {
      const classes = rows.map((row) => row.querySelector(`[data-column="${column}"]`)?.className);
      expect(classes[0]).toBeDefined();
      expect(classes[0]).toBe(classes[1]);
    }
  });

  it('keeps a long action name for screen readers behind a short visible verb', () => {
    const actions: SuggestionActions = {
      primary: {
        label: 'Open rebase',
        shortLabel: 'Rebase',
        isDisabled: false,
        failureTitle: 'Failed',
        run: vi.fn(async () => undefined),
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

    expect(screen.getByRole('button', { name: 'Open rebase' }).textContent).toBe('Rebase');
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

  it('hides Not now and takes it out of the tab order while the action runs', () => {
    const actions: SuggestionActions = {
      primary: { label: 'Rebase', isDisabled: false, failureTitle: 'Failed', run: vi.fn() },
      onDismiss: null,
    };
    const view = render(
      <NextStepRow
        suggestion={suggestion()}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );
    screen.getByRole('button', { name: 'Not now' });

    view.rerender(
      <NextStepRow
        suggestion={suggestion()}
        actions={actions}
        compact={false}
        isPending
        onNotNow={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
    const hidden = screen.getByRole('button', { name: 'Not now', hidden: true });
    expect(hidden.hasAttribute('disabled')).toBe(true);

    view.rerender(
      <NextStepRow
        suggestion={suggestion()}
        actions={actions}
        compact={false}
        isPending={false}
        onNotNow={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Not now' }).hasAttribute('disabled')).toBe(false);
  });

  it('hides Not now while the action reports itself busy', () => {
    const actions: SuggestionActions = {
      primary: {
        label: 'Rebasing',
        isDisabled: true,
        isBusy: true,
        failureTitle: 'Failed',
        run: vi.fn(),
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

    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
  });
});
