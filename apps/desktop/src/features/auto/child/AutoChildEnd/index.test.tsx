// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { anAgent } from '@goodboy/types/testing';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { aDelegation, FIXTURE_SESSION } from '../../testing/autoViewFixtures';
import { delegationCardOf } from '../../chat/delegationCardOf';
import {
  registerDelegationDecisionPort,
  type DelegationDecisionPort,
} from '../../delegationDecisionPort';
import { AutoChildEnd } from './index';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  registerDelegationDecisionPort({ port: null });
});

type ShowParams = {
  readonly delegation: AutoDelegation;
  readonly status?: Agent['status'];
  readonly isReplaced?: boolean;
};

const show = ({ delegation, status = 'running', isReplaced = false }: ShowParams) => {
  const agent = anAgent({ id: delegation.childAgentId, status });
  const card = delegationCardOf({ delegation, childAgent: agent, isReplaced });
  render(
    <AutoChildEnd
      sessionId={FIXTURE_SESSION}
      delegation={delegation}
      card={card}
      agent={agent}
      isReplaced={isReplaced}
    />,
  );
};

describe('the end of an Auto child page', () => {
  it('asks for your OK with Confirm and Decline, never Queued or Stop', async () => {
    const port = vi.fn<DelegationDecisionPort>(async () => 'confirmed');
    registerDelegationDecisionPort({ port });
    const delegation = aDelegation({ key: 'impl', role: 'implementer', state: 'awaiting_confirm' });
    show({ delegation });

    screen.getByText('Needs you');
    expect(screen.queryByText('Queued')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(port).toHaveBeenCalledTimes(1));
    expect(port).toHaveBeenCalledWith({ delegationId: delegation.id, decision: 'confirm' });
  });

  it('declines the child through the same port', async () => {
    const port = vi.fn<DelegationDecisionPort>(async () => 'declined');
    registerDelegationDecisionPort({ port });
    const delegation = aDelegation({ key: 'impl', role: 'implementer', state: 'awaiting_confirm' });
    show({ delegation });

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

    await waitFor(() =>
      expect(port).toHaveBeenCalledWith({ delegationId: delegation.id, decision: 'decline' }),
    );
  });

  it('says a paused child asked a question and offers nothing to stop', () => {
    const delegation = aDelegation({ key: 'impl', role: 'implementer', state: 'paused' });
    show({ delegation });

    screen.getByText('Needs your answer');
    expect(screen.queryByText('Queued')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('keeps Queued and Stop for a child that was only accepted', () => {
    const delegation = aDelegation({ key: 'impl', role: 'implementer', state: 'accepted' });
    show({ delegation });

    screen.getByText('Queued');
    screen.getByRole('button', { name: 'Stop' });
  });

  it('leaves a stopped child to the page notice, with no second Retry at the end', () => {
    const delegation = aDelegation({
      key: 'impl',
      role: 'implementer',
      state: 'settled',
      outcome: 'stopped',
    });
    show({ delegation, status: 'stopped' });

    expect(screen.queryByText('Stopped')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry through Auto' })).toBeNull();
  });

  it('keeps the failure and leaves Retry to the dock when the child failed', () => {
    const delegation = aDelegation({
      key: 'impl',
      role: 'implementer',
      state: 'settled',
      outcome: 'failed',
    });
    show({ delegation, status: 'failed' });

    screen.getByText(/^Failed/);
    expect(screen.queryByRole('button', { name: /^Retry/ })).toBeNull();
  });

  it('reads a child that came back as Returned to Auto with its request, never Failed or Needs you', () => {
    const delegation = {
      ...aDelegation({ key: 'scout', role: 'scout', state: 'settled', outcome: 'blocked' }),
      reason: 'declared_blocked',
      result: { declared: { summary: 'Needs a shell to read commits in payments-api.' } },
    };
    show({ delegation, status: 'blocked' });

    screen.getByText('Returned to Auto: Needs a shell to read commits in payments-api.');
    expect(screen.queryByText(/Failed/)).toBeNull();
    expect(screen.queryByText('Needs you')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Retry/ })).toBeNull();
    expect(document.body.textContent).not.toContain('declared_blocked');
  });

  it.each([
    { reason: 'process_error', sentence: 'The agent ended with an error.' },
    {
      reason: 'no_closing_envelope',
      sentence: 'It ended without saying whether the work was done.',
    },
    { reason: 'report_missing', sentence: 'It ended without writing its report.' },
    { reason: null, sentence: 'The agent did not finish.' },
  ])('says a real failure with a sentence, never the code ($reason)', ({ reason, sentence }) => {
    const delegation = {
      ...aDelegation({ key: 'impl', role: 'implementer', state: 'settled', outcome: 'failed' }),
      reason,
    };
    show({ delegation, status: 'failed' });

    screen.getByText(`Failed: ${sentence}`);
    expect(document.body.textContent).not.toMatch(/_/);
  });

  it('draws no Failed or Needs you for a returned child that Auto handed on', () => {
    const delegation = {
      ...aDelegation({ key: 'scout', role: 'scout', state: 'settled', outcome: 'blocked' }),
      reason: 'declared_blocked',
    };
    show({ delegation, status: 'completed', isReplaced: true });

    expect(screen.queryByText(/Failed/)).toBeNull();
    expect(screen.queryByText('Needs you')).toBeNull();
  });

  it('does not read Idle or Returned to Auto for a returned child that Auto replaced', () => {
    const delegation = {
      ...aDelegation({ key: 'scout', role: 'scout', state: 'settled', outcome: 'blocked' }),
      reason: 'declared_blocked',
    };
    show({ delegation, status: 'blocked', isReplaced: true });

    expect(screen.queryByText(/Returned to Auto/)).toBeNull();
    expect(screen.queryByText('Idle')).toBeNull();
  });
});
