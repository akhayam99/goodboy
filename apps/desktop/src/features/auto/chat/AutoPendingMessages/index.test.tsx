// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AUTO_BLOCK_TEXT } from '@goodboy/core';
import type { AutoPhase } from '@goodboy/db';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { registerSendNowPort, type SendNowPort } from '../../sendNowPort';
import { registerTreeRetryPort } from '../../treeRetryPort';
import { aDelegation, aView, FIXTURE_SESSION, FIXTURE_TREE } from '../../testing/autoViewFixtures';
import { AutoPendingMessages } from '.';
import { autoLimitOpenEvent } from '../autoLimitOpenEvent';
import { pendingMessageLineOf } from '../pendingMessageOf';

afterEach(() => {
  cleanup();
  registerSendNowPort({ port: null });
  registerTreeRetryPort({ port: null });
});

const MESSAGES = [{ rowId: 'outbox-user-2', createdAt: 1_000 }];

const RUNNING = aDelegation({ key: 'impl', role: 'implementer', state: 'running' });

type RenderParams = {
  readonly view: AutoTreeView;
};

const renderPending = ({ view }: RenderParams) =>
  render(<AutoPendingMessages sessionId={FIXTURE_SESSION} view={view} />);

describe('the line under a message that waits', () => {
  it('says what it waits for, with Send now, in one quiet line', () => {
    const { container } = renderPending({
      view: aView({ phase: 'waiting', delegations: [RUNNING], pendingMessages: MESSAGES }),
    });

    screen.getByText('Waits for work for impl');
    screen.getByRole('button', { name: 'Send now' });
    expect(container.querySelectorAll('[data-auto-pending-message]')).toHaveLength(1);
  });

  it('counts the agents when more than one runs', () => {
    renderPending({
      view: aView({
        phase: 'waiting',
        delegations: [RUNNING, aDelegation({ key: 'scout', role: 'scout', state: 'running' })],
        pendingMessages: MESSAGES,
      }),
    });

    screen.getByText('Waits for 2 agents');
  });

  it('asks the main window to send it now, naming the tree and the message', async () => {
    const port = vi.fn<SendNowPort>(async () => ({ kind: 'retried' }));
    registerSendNowPort({ port });
    renderPending({
      view: aView({ phase: 'waiting', delegations: [RUNNING], pendingMessages: MESSAGES }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));

    await waitFor(() =>
      expect(port).toHaveBeenCalledWith({ treeId: FIXTURE_TREE, rowId: 'outbox-user-2' }),
    );
  });

  it('shows the reason when Send now is refused', async () => {
    registerSendNowPort({
      port: async () => ({ kind: 'refused', message: 'Another window runs this conversation.' }),
    });
    renderPending({
      view: aView({ phase: 'waiting', delegations: [RUNNING], pendingMessages: MESSAGES }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));

    await screen.findByText('Another window runs this conversation.');
  });

  it('goes away once the message is delivered', () => {
    const { container } = renderPending({
      view: aView({ phase: 'waiting', delegations: [RUNNING], pendingMessages: [] }),
    });

    expect(container.textContent).toBe('');
  });
});

describe('the line under a message that was not delivered', () => {
  it('shows the budget reason with the limit action', () => {
    const view = aView({
      phase: 'blocked',
      pendingMessages: MESSAGES,
    });
    const blocked = {
      ...view,
      tree: { ...view.tree, blockedReason: AUTO_BLOCK_TEXT.budget },
    };
    const listener = vi.fn();
    window.addEventListener(autoLimitOpenEvent({ treeId: FIXTURE_TREE }), listener);
    renderPending({ view: blocked });

    screen.getByText(`Not delivered: ${AUTO_BLOCK_TEXT.budget}`);
    fireEvent.click(screen.getByRole('button', { name: 'Change limit' }));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(autoLimitOpenEvent({ treeId: FIXTURE_TREE }), listener);
  });

  it('offers Retry for a block that Retry can lift', async () => {
    const retry = vi.fn(async () => ({ kind: 'retried' as const }));
    registerTreeRetryPort({ port: retry });
    const view = aView({ phase: 'blocked', pendingMessages: MESSAGES });
    renderPending({
      view: { ...view, tree: { ...view.tree, blockedReason: 'Claude is not signed in' } },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(retry).toHaveBeenCalledWith({ treeId: FIXTURE_TREE }));
  });

  it('says the time limit with no action, since nothing can lift it', () => {
    const view = aView({ phase: 'blocked', pendingMessages: MESSAGES });
    renderPending({
      view: { ...view, tree: { ...view.tree, blockedReason: AUTO_BLOCK_TEXT.limit_wall_clock } },
    });

    screen.getByText(`Not delivered: ${AUTO_BLOCK_TEXT.limit_wall_clock}`);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says a stopped tree did not take it', () => {
    renderPending({ view: aView({ phase: 'stopped', pendingMessages: MESSAGES }) });

    screen.getByText('Not delivered: Auto was stopped.');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('pendingMessageLineOf', () => {
  it('has no line for a tree that is about to deliver', () => {
    const phases: ReadonlyArray<AutoPhase> = [
      'answering',
      'merging',
      'deciding',
      'delegating',
      'done',
      'finished',
    ];
    for (const phase of phases) {
      expect(pendingMessageLineOf({ view: aView({ phase }) })).toBeNull();
    }
  });

  it('has no line for a waiting tree with no open child', () => {
    expect(pendingMessageLineOf({ view: aView({ phase: 'waiting' }) })).toBeNull();
  });
});
