// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { anAgent } from '@goodboy/types/testing';
import type { AutoDelegation } from '@goodboy/db';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { aDelegation, FIXTURE_SESSION } from '../testing/autoViewFixtures';
import { delegationCardOf } from '../chat/delegationCardOf';
import { registerDelegationDecisionPort } from '../delegationDecisionPort';
import { AutoChildEnd } from './AutoChildEnd';

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
};

const show = ({ delegation }: ShowParams) => {
  const agent = anAgent({ id: delegation.childAgentId });
  const card = delegationCardOf({ delegation, childAgent: agent });
  render(
    <AutoChildEnd sessionId={FIXTURE_SESSION} delegation={delegation} card={card} agent={agent} />,
  );
};

describe('the end of an Auto child pane', () => {
  it('asks for your OK with Confirm and Decline, never Queued or Stop agent', async () => {
    const port = vi.fn(async () => 'confirmed' as const);
    registerDelegationDecisionPort({ port });
    const delegation = aDelegation({ key: 'impl', role: 'implementer', state: 'awaiting_confirm' });
    show({ delegation });

    screen.getByText('Waiting for your OK');
    expect(screen.queryByText('Queued')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop agent' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(port).toHaveBeenCalledTimes(1));
    expect(port).toHaveBeenCalledWith({ delegationId: delegation.id, decision: 'confirm' });
  });

  it('declines the child through the same port', async () => {
    const port = vi.fn(async () => 'declined' as const);
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

    screen.getByText('Asked a question');
    expect(screen.queryByText('Queued')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop agent' })).toBeNull();
  });

  it('keeps Queued and Stop agent for a child that was only accepted', () => {
    const delegation = aDelegation({ key: 'impl', role: 'implementer', state: 'accepted' });
    show({ delegation });

    screen.getByText('Queued');
    screen.getByRole('button', { name: 'Stop agent' });
  });
});
